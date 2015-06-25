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
			return this.loader.resolveURL(url);
		},

		// https://github.com/systemjs/systemjs/blob/5ed14adca58abd3cf6c29783abd53af00b0c5bff/lib/package.js#L80
		normalize: function(name, contextName, contextAddress){
			var absURLRegEx = /^([^\/]+:\/\/|\/)/;
			var firstChar = name[0], normalizedName;

			if( firstChar === '.' && contextName ){
				if( contextName.match(absURLRegEx) ){
					normalizedName = new URL(name, contextName);
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
			//debug(name, 'normalize:', normalizedName);

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
				address = new URL(sourceLocation);
			}

			definePathnameParts(module, address);

			if( module.extname != this.extension ){
				module.extname = this.extension;
				address.pathname+= module.extname;
				module.meta.source+= module.extname;
				if( module.meta.origin ) module.meta.origin+= module.extname;
			}

			//debug(name, 'source:', module.meta.source);
			//debug(name, 'origin:', module.meta.origin);

			return address;
		},

		createModuleNotFoundError: function(module){
			var error = new Error('module not found ' + this.getSource(module));
			error.code = 'MODULE_NOT_FOUND';
			return error;
		},

		createSourceMissingError: function(module){
			var error = new Error(module.name + ' has no source');
			error.code = 'SOURCE_MISSING';
			return error;
		},

		createOriginMissingError: function(module){
			var error = new Error(module.name + ' has no origin');
			error.code = 'ORIGIN_MISSING';
			return error;
		},

		createOriginNotFoundError: function(module){

		},

		getSource: function(module){
			var sourceLocation = this.resolveURL(module.meta.source);
			if( !sourceLocation ){
				throw this.createSourceMissingError(module);
			}

			return sourceLocation;
		},

		getOrigin: function(module){
			var origin = module.meta.origin;
			if( !origin ){
				throw this.createOriginMissingError(module);
			}

			return this.resolveURL(module.meta.origin);
		},

		read: function(location, options){
			return Promise.resolve(this.loader.read(location, options));
		},

		write: function(location, body, options){
			return Promise.resolve(this.loader.write(location, body, options));
		},

		install: function(module, promise){
			var sourceLocation = this.getSource(module);

			return promise.then(function(response){
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
		},

		// update mode react on 200 to project by read origin & write source when from is more recent
		update: function(module, promise){
			var sourceLocation = this.getSource(module), self = this;

			return promise.then(function(response){
				var originLocation;

				try{
					originLocation = self.getOrigin(module);
				}
				catch(e){
					return response;
				}
				debug(sourceLocation, 'found, trying to update from', originLocation);

				var request = {};

				if( module.meta.mtime ){
					request.headers = {};
					request.headers['if-modified-since'] = module.meta.mtime;
				}

				return self.read(originLocation, request).then(function(originResponse){
					debug('origin responded with', originResponse.status);

					// 304 -> return sourceResponse
					if( originResponse.status == 304 ){
						return response;
					}
					// 200 -> return sourceResponse after writing originalResponse
					if( originResponse.status == 200 ){
						return self.write(sourceLocation, originResponse.body).then(function(){
							return response;
						});
					}
					// others -> return originResponse
					return originResponse;
				});
			}).catch(function(error){
				debug('update failed :', error.message);
				return Promise.reject(error);
			});
		},

		createResponsePromise: function(module){
			var sourceLocation = this.getSource(module);
			var readPromise = this.read(sourceLocation);

			// mtime
			readPromise = readPromise.then(function(response){
				if( response.headers['last-modified'] ){
					module.meta.mtime = response.headers['last-modified'];
				}
				return response;
			});

			var mode = this.loader.mode;
			if( mode === 'install' ){
				// install mode react on 404 to project by read origin & write source
				readPromise = readPromise.then(function(response){
					if( response.status != 404 ) return response;
					return this.install(module, Promise.resolve(response));
				}.bind(this));
			}
			else if( mode === 'update' ){
				readPromise = readPromise.then(function(response){
					if( response.status != 200 ) return response;
					return this.update(module, Promise.resolve(response));
				}.bind(this));
			}

			readPromise = readPromise.then(function(response){
				module.meta.response = response;

				if( response.status === 404 ){
					throw this.createModuleNotFoundError(module);
				}
				else if( response.status != 200 ){
					throw new Error('fetch failed with response status: ' + response.status);
				}

				return response;
			}.bind(this));

			return readPromise;
		},

		fetch: function(module){
			return this.createResponsePromise(module).then(function(response){
				return response.body.readAsString().then(function(body){
					return body;
				});
			});
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

		resolveURL: function(url){
			return new URL(url, this.baseURL);
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
	jsenv.ready(function setupLoader(){
		loader.baseURL = new URL(jsenv.baseURL, jsenv.baseURI);

		debug('loader baseURL', loader.baseURL);

		loader.mode = jsenv.mode;
		if( !loader.mode ){
			throw new Error('loader.mode not set');
		}

		debug('loader mode', loader.mode);

		for(var key in loader.loaders){
			loader.loaders[key] = loader.createLoader(this.require(loader.loaders[key]));
		}

		debug('loader used', Object.keys(loader.loaders));
	});

})(jsenv);