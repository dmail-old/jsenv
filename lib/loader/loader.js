/* globals debug */

(function(jsenv){

	var es6Loader = jsenv.require('es6-loader');
	var store = jsenv.require('store');
	var mediaHandler = {
		extensions: {
			/*
			"js": "application/javascript",
			"css": "text/css",
			"html": "text/html",
			"txt": "text/plain"
			*/
		},
		medias: {},

		createNotFoundError: function(mediaType){
			var error = new Error('unsupported media : ' + mediaType);
			return error;
		},

		getExtensionMedia: function(extension){
			return this.extensions[extension];
		},

		setExtensionMedia: function(extension, mediaType){
			this.extensions[mediaType] = extension;
		},

		get: function(mediaType){
			if( mediaType in this.medias ){
				return this.medias[mediaType];
			}
			else{
				throw new this.createNotFoundError(mediaType);
			}
		}
	};

	// get storage for this module (depends on location)
	function getStorage(module){
		return store.get(module.address);
	}

	function getMediaType(module){
		// mediaType says how to handle the module source (as js, css...)
		return module.meta.response.headers['content-type'] || mediaHandler.getExtensionMedia(module.extname.slice(1));
	}

	function getMedia(module){
		return mediaHandler.get(getMediaType(module));
	}

	function parsePathname(pathname){
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

		return {
			dirname: dirname,
			basename: basename,
			extname: extname
		};
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

	function findMeta(location){
		return jsenv.findMeta(location);
	}

	function resolveURL(url){
		return new URL(url, loader.baseURL);
	}

	function getSource(module){
		var sourceLocation = resolveURL(module.meta.source);
		if( !sourceLocation ){
			throw createSourceMissingError(module);
		}

		return sourceLocation;
	}

	function getOrigin(module){
		var origin = module.meta.origin;
		if( !origin ){
			throw createOriginMissingError(module);
		}

		return resolveURL(module.meta.origin);
	}

	function createModuleNotFoundError(module){
		var error = new Error('module not found ' + getSource(module));
		error.code = 'MODULE_NOT_FOUND';
		return error;
	}

	function createSourceMissingError(module){
		var error = new Error(module.name + ' has no source');
		error.code = 'SOURCE_MISSING';
		return error;
	}

	function createOriginMissingError(module){
		var error = new Error(module.name + ' has no origin');
		error.code = 'ORIGIN_MISSING';
		return error;
	}

	function createOriginNotFoundError(module){
		var error = new Error('module not found ' + getOrigin(module));
		error.code = 'MODULE_ORIGIN_NOT_FOUND';
		return error;
	}

	function read(location, options){
		return store.get(location).read(location, options);
	}

	function write(location, body, options){
		return store.get(location).write(location, body, options);
	}

	function install(module, promise){
		var sourceLocation = getSource(module);

		return promise.then(function(response){
			var originLocation = getOrigin(module);
			debug(sourceLocation, 'not found, trying to get it at', originLocation);

			return read(originLocation).then(function(response){
				debug('origin responded with', response.status);

				if( response.status != 200 ) return response;

				debug('writing body at', sourceLocation);
				return write(sourceLocation, response.body).then(function(){
					return response;
				});
			});
		}).catch(function(error){
			debug('install failed :', error.message);
			return Promise.reject(error);
		});
	}

	// update mode react on 200 to project by read origin & write source when from is more recent
	function update(module, promise){
		var sourceLocation = getSource(module);

		return promise.then(function(response){
			var originLocation;

			try{
				originLocation = getOrigin(module);
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

			return read(originLocation, request).then(function(originResponse){
				debug('origin responded with', originResponse.status);

				// 304 -> return sourceResponse
				if( originResponse.status == 304 ){
					return response;
				}
				// 200 -> return sourceResponse after writing originalResponse
				if( originResponse.status == 200 ){
					return write(sourceLocation, originResponse.body).then(function(){
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
	}

	function createResponsePromise(module){
		var sourceLocation = getSource(module);
		var readPromise = read(sourceLocation);

		// mtime
		readPromise = readPromise.then(function(response){
			if( response.headers['last-modified'] ){
				module.meta.mtime = response.headers['last-modified'];
			}
			return response;
		});

		var mode = loader.mode;
		if( mode === 'install' ){
			// install mode react on 404 to project by read origin & write source
			readPromise = readPromise.then(function(response){
				if( response.status != 404 ) return response;
				return install(module, Promise.resolve(response));
			});
		}
		else if( mode === 'update' ){
			readPromise = readPromise.then(function(response){
				if( response.status != 200 ) return response;
				return update(module, Promise.resolve(response));
			});
		}

		readPromise = readPromise.then(function(response){
			module.meta.response = response;

			if( response.status === 404 ){
				throw createModuleNotFoundError(module);
			}
			else if( response.status != 200 ){
				throw new Error('fetch failed with response status: ' + response.status);
			}

			return response;
		});

		return readPromise;
	}

	var jsenvLoader = Function.extend(es6Loader, {
		mode: null, // 'install', 'update', 'run'
		baseURL: null,
		extname: '.js',

		constructor: function(options){
			es6Loader.call(this, options);
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
				normalizedName = resolveURL(name);
			}
			else{
				normalizedName = name;
			}

			normalizedName = String(normalizedName);
			var meta = findMeta(normalizedName);
			if( meta.alias ) normalizedName = meta.alias;

			debug(name, 'normalize:', normalizedName);

			return normalizedName;
		},

		// https://github.com/systemjs/systemjs/blob/0.17/lib/core.js
		locate: function(module){
			var name = module.name, meta, sourceLocation, firstChar, address;

			meta = findMeta(name);
			Object.assign(module.meta, meta);
			sourceLocation = module.meta.source;
			firstChar = sourceLocation[0];

			// relative names
			if( firstChar === '/' || firstChar === '.' ){
				address = resolveURL(sourceLocation);
			}
			// absolute names
			else{
				address = new URL(sourceLocation);
			}

			var parts = parsePathname(address.pathname);
			// add the parent extension
			if( !parts.extname && module.parent ){
				parts.extname = module.extname;

				address.pathname+= module.extname;
				module.meta.source+= module.extname;
				if( module.meta.origin ) module.meta.origin+= module.extname;
			}

			Object.assign(module, parts);

			debug(name, 'source:', module.meta.source);
			debug(name, 'origin:', module.meta.origin);

			return address;
		},

		fetch: function(module){
			debug('fetch', module);

			module.storage = getStorage(module);

			return createResponsePromise(module).then(function(response){
				module.media = getMedia(module);

				return response.body.readAsString().then(function(body){
					return body;
				});
			});
		},

		collectDependencies: function(module){
			return module.media.collectDependencies(module);
		},

		parse: function(module){
			return module.media.parse(module);
		},

		execute: function(module){
			return module.media.execute(module);
		}
	});

	var loader = new jsenvLoader();

	jsenv.loader = loader;
	jsenv.defineMedia = function(mediaType, extension, media){
		mediaHandler.setExtensionMedia(extension, mediaType);
		mediaHandler.medias[mediaType] = media;
	};
	jsenv.include = function(normalizedName, options){
		var module = this.loader.createModule(normalizedName, options);

		return module.then(function(){
			module.parse();
			module.execute();
			return module;
		});
	};

	jsenv.need('media-js');
	//jsenv.need('media-css');

	jsenv.define('loader');
	jsenv.ready(function setupLoader(){
		loader.baseURL = new URL(jsenv.baseURL, jsenv.baseURI);
		debug('loader baseURL', loader.baseURL);

		loader.mode = jsenv.mode;
		if( !loader.mode ){
			throw new Error('loader.mode not set');
		}

		debug('supported medias :', Object.keys(mediaHandler.medias));
	});

})(jsenv);