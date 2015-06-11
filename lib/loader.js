/* globals debug */

(function(jsenv){

	var Module = jsenv.require('module');
	var es6Loader = jsenv.require('es6-loader');

	function definePathnameParts(module, address){
		var pathname = address.pathname;
		var slashLastIndexOf = pathname.lastIndexOf('/');
		var dirname, basename, extname;
		var dotLastIndexOf;

		if( slashLastIndexOf === -1 ){
			dirname = '.';
			basename = pathname;
		}
		else{
			dirname = pathname.slice(0, slashLastIndexOf);
			basename = pathname.slice(slashLastIndexOf + 1);
		}

		dotLastIndexOf = basename.lastIndexOf('.');
		if( dotLastIndexOf === -1 ){
			extname = '';
		}
		else{
			extname = basename.slice(dotLastIndexOf);
		}

		module.dirname = dirname;
		module.basename = basename;
		module.extname = extname;
	}

	function resolvePath(name, parentName){
		// skip leading ./
		var parts = name.split('/');
		var i = 0;
		var dotdots = 0;
		while( parts[i] == '.' ){
			i++;
			if( i == parts.length ){
				throw new TypeError('Invalid module name');
			}
		}
		// count dot dots
		while( parts[i] == '..' ){
			i++;
			dotdots++;
			if( i == parts.length ){
			  throw new TypeError('Invalid module name');
			}
		}

		var parentParts = parentName.split('/');

		parts = parts.splice(i, parts.length - i);

		// if backtracking below the parent name, just set to the base-level like URLs
		// NB if parentAddress is supported in the spec, we can URL normalize against it here instead
		if( dotdots > parentParts.length ){
			throw new TypeError('Normalization of "' + name + '" to "' + parentName + '" back-tracks below the parent');
		}
		parts = parentParts.splice(0, parentParts.length - dotdots - 1).concat(parts);

		return parts.join('/');
	}

	var jsenvLoader = Function.extend(es6Loader, {
		constructor: function(loader, options){
			es6Loader.call(this, options);
			this.loader = loader;
		},

		resolveURL: function(url){
			return new URI(url, this.loader.baseURL);
		},

		// https://github.com/systemjs/systemjs/blob/5ed14adca58abd3cf6c29783abd53af00b0c5bff/lib/package.js#L80
		normalize: function(name, contextName, contextAddress){
			var absURLRegEx = /^([^\/]+:\/\/|\/)/;
			var firstChar = name[0], normalizedName;

			if( firstChar === '.' && contextName ){
				if( contextName.match(absURLRegEx) ){
					normalizedName = new URI(name, contextName);
				}
				else{
					normalizedName = resolvePath(name, contextName);
				}
			}
			else if( firstChar === '.' || firstChar === '/' ){
				normalizedName = this.resolveURL(name);
			}
			else{
				normalizedName = name;
			}

			normalizedName = String(normalizedName);
			var meta = this.loader.findMeta(normalizedName);
			if( meta.alias ) normalizedName = meta.alias;
			debug(name, 'normalize:', normalizedName);

			return normalizedName;
		},

		// https://github.com/systemjs/systemjs/blob/0.17/lib/core.js
		locate: function(module){
			var name = module.name, meta, sourceLocation, firstChar, address;

			meta = this.loader.findMeta(name);
			Object.assign(module.meta, meta);
			sourceLocation = module.meta.source;
			firstChar = sourceLocation[0];

			// relative names
			if( firstChar === '/' || firstChar === '.' ){
				address = this.resolveURL(sourceLocation);
			}
			// absolute names
			else{
				address = new URI(sourceLocation);
			}

			definePathnameParts(module, address);

			if( module.extname != this.extension ){
				module.extname = this.extension;
				address.pathname+= module.extname;
				module.meta.source+= module.extname;
				if( module.meta.origin ) module.meta.origin+= module.extname;
			}

			debug(name, 'source:', module.meta.source);
			debug(name, 'origin:', module.meta.origin);

			//console.log('ORIGIN', module.name, module.meta.origin);

			return address;
		},

		read: function(location, options){
			return Promise.resolve(this.loader.read(location, options));
		},

		write: function(location, body, options){
			return Promise.resolve(this.loader.write(location, body, options));
		},

		createSourceLocationError: function(module){
			var error = new TypeError('module.meta.source is undefined');
			return error;
		},

		createOriginNotFoundError: function(module){
			var error = new Error(module.name + ' has no origin');
			error.code = 'ORIGIN_NOT_FOUND';
			return error;
		},

		getSource: function(module){
			var sourceLocation = this.resolveURL(module.meta.source);
			if( !sourceLocation ){
				throw this.createSourceLocationError(module);
			}

			return sourceLocation;
		},

		getOrigin: function(module){
			var origin = module.meta.origin;
			if( !origin ){
				throw this.createOriginNotFoundError(module);
			}

			return this.resolveURL(module.meta.origin);
		},

		fetch: function(module){
			var sourceLocation = this.getSource(module);
			var readPromise = this.read(sourceLocation);

			var mode = this.loader.mode;
			// install mode react on 404 to project by read origin & write source
			if( mode === 'install' ){
				readPromise = readPromise.then(function(response){
					if( response.status != 404 ) return response;
					var originLocation = this.getOrigin(module);
					debug(sourceLocation, 'not found, trying to get it at', originLocation);

					return this.read(originLocation).then(function(response){
						debug('origin responded with', response.status);

						if( response.status != 200 ) return response;

						debug('writing body at', sourceLocation);
						return this.write(sourceLocation, response.body).then(function(){
							return response;
						});
					});
				}.bind(this)).catch(function(error){
					debug('install failed :', error.message);
					return Promise.reject(error);
				});
			}
			// update mode react on 200 to project by read origin & write source when from is more recent
			else if( mode === 'update' ){
				readPromise = readPromise.then(function(response){
					if( response.status != 200 ) return response;
					var originLocation = this.getOrigin(module);
					debug(sourceLocation, 'found, trying to update from', originLocation);

					var request = {
						mtime: module.meta.mtime
					};

					return this.read(originLocation, request).then(function(response){
						if( response.status != 200 ) return response; // only on 200 status
						return this.write(sourceLocation, response.body).then(function(){
							return response;
						});
					});
				}.bind(this));
			}

			readPromise = readPromise.then(function(response){
				module.meta.response = response;
				if( response.mtime ){
					module.meta.mtime = response.mtime;
				}

				if( response.status === 404 ){
					throw this.createModuleNotFoundError(sourceLocation);
				}
				else if( response.status != 200 ){
					if( response.status === 500 && response.body instanceof Error ){
						throw response.body;
					}
					else{
						throw new Error('fetch failed with response status: ' + response.status);
					}
				}

				return response.body;
			}.bind(this));

			return readPromise;
		}
	});

	var loader = {
		mode: null, // 'install', 'update', 'run'
		Loader: jsenvLoader,
		loaders: {},
		env: jsenv,

		findMeta: function(location){
			return this.env.findMeta(location);
		},

		getModuleLoader: function(location){
			// dependending of the location returns loaders.js or loaders.css etc...
		},

		createModule: function(normalizedName, options){
			var loader = this.loaders.js; // todo

			normalizedName = loader.normalize(normalizedName);
			var module = loader.createModule(normalizedName);

			// prevent locate()
			if( options && options.address ){
				module.address = options.address;
			}

			return module;
		},

		use: function(name){
			this.loaders[name] = 'loader-' + name;
			this.env.need(this.loaders[name]);
		},

		createLoader: function(options){
			return new this.Loader(this, options);
		},

		read: function(location, options){
			return Promise.reject(new Error('loader.read() unimplemented'));
		},

		write: function(location, body, options){
			return Promise.reject(new Error('loader.write() unimplemented'));
		},

		setup: function(){
			this.baseURL = new URI(jsenv.baseURL, jsenv.baseURI);

			this.mode = jsenv.mode;
			if( !this.mode ){
				throw new Error('loader.mode not set');
			}

			for(var key in this.loaders){
				this.loaders[key] = this.createLoader(this.env.require(this.loaders[key]));
			}
		}
	};

	jsenv.loader = loader;
	jsenv.loader.use('js');
	jsenv.include = function(normalizedName, options){
		var module = this.loader.createModule(normalizedName, options);

		return module.then(function(){
			module.parse();
			module.execute();
			return module;
		});
	};

	jsenv.define('loader');
})(jsenv);