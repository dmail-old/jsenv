/* globals debug */

(function(jsenv){

	var Module = jsenv.require('module');
	var es6Loader = jsenv.require('es6-loader.js');

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
		constructor: function(env, options){
			es6Loader.call(this, options);
			this.env = env;
		},

		findStorage: function(url){
			url = new URI(url);
			var name = url.protocol.slice(0, -1); // remove ':' from 'file:'
			var storage = this.env.platform.findStorage(name);
			if( !storage ){
				throw new Error('storage not found : ' + url);
			}
			return storage;
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
				normalizedName = new URI(name, this.baseURL);
			}
			else{
				normalizedName = name;
			}

			normalizedName = String(normalizedName);
			var meta = this.env.findMeta(normalizedName);
			if( meta.alias ) normalizedName = meta.alias;
			debug(name, 'normalize:', normalizedName);

			return normalizedName;
		},

		// https://github.com/systemjs/systemjs/blob/0.17/lib/core.js
		locate: function(module){
			var name = module.name, meta, sourceLocation, firstChar, address;

			meta = this.env.findMeta(name);
			Object.assign(module.meta, meta);
			sourceLocation = module.meta.source;
			firstChar = sourceLocation[0];

			// relative names
			if( firstChar === '/' || firstChar === '.' ){
				address = new URI(sourceLocation, this.baseURL);
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
				module.meta.origin+= module.extname;
			}

			debug(name, 'source:', module.meta.source);
			debug(name, 'origin:', module.meta.origin);

			//console.log('ORIGIN', module.name, module.meta.origin);

			return address;
		},

		fetch: function(module){
			var sourceLocation = String(new URI(module.meta.source, this.baseURL));
			if( typeof sourceLocation != 'string' ){
				throw new TypeError('module.meta.to must be a string');
			}
			var sourceStorage = this.findStorage(sourceLocation);
			if( !sourceStorage.get ){
				throw new Error('unsupported read at ' + sourceLocation);
			}

			var mode = this.env.mode;
			var promise = sourceStorage.get(sourceLocation, {});

			// install mode react on 404 to project by read origin & write source
			if( mode === 'install' ){
				promise = promise.then(function(response){
					if( response.status != 404 ) return response;

					var originLocation = String(new URI(module.meta.origin, this.baseURL));
					if( !originLocation ){
						throw new Error('cannot install: ' + sourceLocation + ' has no origin');
					}
					if( !sourceStorage.set ){
						throw new Error('cannot install: unsupported write at ' + sourceLocation);
					}
					var originStorage = this.findStorage(originLocation);
					if( !originStorage.get ){
						throw new Error('cannot install: unsupported read at ' + originLocation);
					}

					debug(sourceLocation, 'not found, trying to get it at', originLocation);
					return originStorage.get(originLocation, {}).then(function(response){
						debug('origin responded with', response.status);

						if( response.status != 200 ) return response;

						debug('writing body at', sourceLocation);
						return sourceStorage.set(sourceLocation, response.body, {}).then(function(){
							return response;
						});
					});
				}.bind(this));
			}
			// update mode react on 200 to project by read origin & write source when from is more recent
			else if( mode === 'update' ){
				promise = promise.then(function(response){
					if( response.status != 200 ) return response;

					var originLocation = String(new URI(module.meta.origin, this.baseURL));
					if( !originLocation ){
						debug('skip update : undefined origin', sourceLocation);
						return response;
					}
					if( !sourceStorage.set ){
						debug('skip update : unwritable source', sourceLocation);
						return response;
					}

					var originStorage = this.findStorage(originLocation);
					var request = {
						mtime:  module.meta.mtime
					};

					return originStorage.get(originLocation, request).then(function(response){
						if( response.status != 200 ) return response; // only on 200 status
						return sourceStorage.set(sourceLocation, response.body, {}).then(function(){
							return response;
						});
					});
				}.bind(this));
			}

			promise = promise.then(function(response){
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

			return promise;
		}
	});

	jsenv.Loader = jsenvLoader;
	jsenv.createLoader = function(options){
		return new this.Loader(this, options);
	};

	jsenv.createJSLoader = function(){
		return this.createLoader({
			extension: '.js',
			baseURL: new URI(this.baseURL, this.baseURI),

			collectDependencies: (function(){
				// https://github.com/jonschlinkert/strip-comments/blob/master/index.js
				var reLine = /(^|[^\S\n])(?:\/\/)([\s\S]+?)$/gm;
				var reLineIgnore = /(^|[^\S\n])(?:\/\/[^!])([\s\S]+?)$/gm;
				function stripLineComment(str, safe){
					return String(str).replace(safe ? reLineIgnore : reLine, '');
				}

				var reBlock = /\/\*(?!\/)(.|[\r\n]|\n)+?\*\/\n?\n?/gm;
				var reBlockIgnore = /\/\*(?!(\*?\/|\*?\!))(.|[\r\n]|\n)+?\*\/\n?\n?/gm;
				function stripBlockComment(str, safe){
					return String(str).replace(safe ? reBlockIgnore : reBlock, '');
				}

				var reDependency = /(?:^|;|\s+|ENV\.)include\(['"]([^'"]+)['"]\)/gm;
				// for the moment remove regex for static ENV.include(), it's just an improvment but
				// not required at all + it's strange for a dynamic ENV.include to be preloaded
				reDependency = /(?:^|;|\s+)include\(['"]([^'"]+)['"]\)/gm;
				function collectIncludeCalls(str){
					str = stripLineComment(stripBlockComment(str));

					var calls = [], match;
					while(match = reDependency.exec(str) ){
						calls.push(match[1]);
					}
					reDependency.lastIndex = 0;

					return calls;
				}

				return function collectDependencies(module){
					return collectIncludeCalls(module.source);
				};
			})(),

			eval: function(code, url){
				if( url ){
					url = String(url);
					if( url.indexOf('file:/') === 0 ){
						url = url.slice('file:/'.length);
					}
					code+= '\n//# sourceURL=' + url;

				}
				return eval(code);
			},

			parse: function(module){
				return this.eval('(function(module, include){\n\n' + module.source + '\n\n});', module.address);
			},

			execute: function(module){
				return module.parsed.call(this.global, module, module.include.bind(module));
			}
		});
	};

	jsenv.setupLoader = function(){
		this.loader = this.createJSLoader();
	};

	jsenv.define('loader');
})(jsenv);