/* globals debug */

(function(jsenv){

	var es6Loader = jsenv.require('es6-loader');
	var store = jsenv.require('store');

	function getMediaFromContentType(contentType){
		var index = contentType.indexOf(';'), mediaType;

		if( index === -1 ){
			mediaType = contentType;
		}
		else{
			mediaType = contentType.slice(0, index);
		}

		return mediaType;
	}

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
		Media: Function.create({
			constructor: function(type, properties){
				this.type = type;
				Object.assign(this, properties);
			},
			collectDependencies: function(module){},
			translate: function(module){ return module.body; },
			parse: function(module){},
			execute: function(module){},
			toMedia: function(module){ return this; }
		}),

		register: function(mediaType, properties){
			var media = new this.Media(mediaType, properties);
			this.medias[mediaType] = media;
		},

		registerExtension: function(mediaType, extension){
			this.extensions[extension] = mediaType;
		},

		createNotFoundError: function(mediaType){
			var error = new Error('unsupported media : ' + mediaType);
			return error;
		},

		getExtensionMedia: function(extension){
			return this.extensions[extension];
		},

		get: function(mediaType){
			if( mediaType in this.medias ){
				return this.medias[mediaType];
			}
			else{
				throw new this.createNotFoundError(mediaType);
			}
		},

		findByExtension: function(extension){
			var media = this.get(this.getExtensionMedia(extension));

			if( !media ){
				throw new Error('unregistered extension media : ' + extension);
			}

			return media;
		},

		findByContentType: function(contentType){
			return this.get(getMediaFromContentType(contentType));
		},

		findByModuleExtension: function(module){
			return this.findByExtension(module.extname.slice(1));
		},

		findByModule: function(module){
			var response = module.meta.response, media;

			if( response.headers.has('content-type') ){
				media = this.findByContentType(response.headers.get('content-type'));
			}
			else{
				media = this.findByModuleExtension(module);
			}

			return media.toMedia(module);
		}
	};

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

	// install mode react on 404 to project by read origin & write source
	function install(module, promise){
		var sourceLocation = getSource(module);

		return promise.then(function(response){
			if( response.status !== 404 ) return response;

			var originLocation = getOrigin(module);
			//debug(sourceLocation, 'not found, trying to get it at', originLocation);

			return store.read(originLocation).then(function(response){
				//debug('origin responded with', response.status);
				if( response.status != 200 ) return response;
				return store.write(sourceLocation, response.body).then(function(){
					return response;
				});
			});
		}).catch(function(error){
			debug('install failed :', error.message);
			return Promise.reject(error);
		});
	}

	// test mode react on 404 to project by read origin
	function test(module, promise){
		var sourceLocation = getSource(module);

		return promise.then(function(response){
			if( response.status !== 404 ) return response;
			var originLocation = getOrigin(module);
			return store.read(originLocation);
		});
	}

	// update mode react on 200 to project by read origin & write source when from is more recent
	function update(module, promise){
		var sourceLocation = getSource(module);

		return promise.then(function(response){
			if( response.status != 200 ) return response;

			var originLocation;

			try{
				originLocation = getOrigin(module);
			}
			catch(e){
				return response;
			}
			debug(sourceLocation, 'found, trying to update from', originLocation);

			jsenv.http.cache.set(originLocation, response);

			return store.read(originLocation).then(function(originResponse){
				//debug('origin responded with', originResponse.status);

				// response came from cache
				if( originResponse.cacheState !== 'none' ){
					return originResponse;
				}
				// return response after writing originalResponse
				else{
					return store.write(sourceLocation, originResponse.body).then(function(){
						return originResponse;
					});
				}
			});
		}).catch(function(error){
			debug('update failed :', error.message);
			return Promise.reject(error);
		});
	}

	function createResponsePromise(module){
		var sourceLocation = getSource(module);
		var readPromise = store.read(sourceLocation);

		var mode = loader.mode;
		if( mode === 'install' ){
			readPromise = install(module, readPromise);
		}
		else if( mode === 'test' ){
			readPromise = test(module, readPromise);
		}
		else if( mode === 'update' ){
			readPromise = update(module, readPromise);
		}

		readPromise = readPromise.then(function(response){
			module.meta.response = response;

			if( response.status === 404 ){
				throw createModuleNotFoundError(module);
			}
			else if( response.status != 200 ){
				return response.body.readAsString().then(function(body){
					//console.log(response.status, body);
					throw new Error(response.status + ' ' + sourceLocation + '\n' + body);
				});
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

			//debug(name, 'normalize:', normalizedName);

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
				parts.extname = module.parent.extname;

				address.pathname+= parts.extname;
				module.meta.source+= parts.extname;
				if( module.meta.origin ) module.meta.origin+= parts.extname;
			}

			Object.assign(module, parts);

			//debug(name, 'source:', module.meta.source);
			//debug(name, 'origin:', module.meta.origin);

			return address;
		},

		fetch: function(module){
			//debug('fetch', module);
			//module.storage = getStorage(module);

			return createResponsePromise(module).then(function(response){
				module.media = jsenv.media.findByModule(module);
				return response.text();
			});
		},

		collectDependencies: function(module){
			return module.media.collectDependencies(module);
		},

		translate: function(module){
			var ret;

			try{
				ret = module.media.translate(module);
			}
			catch(e){
				throw e;
			}

			return ret;
		},

		parse: function(module){
			var ret;

			try{
				ret = module.media.parse(module);
			}
			catch(e){
				e.filename = String(module.address);
				throw e;
			}

			return ret;
		},

		execute: function(module){
			var ret;

			try{
				ret = module.media.execute(module);
			}
			catch(e){
				e.filename = String(module.address);
				throw e;
			}

			return ret;
		}
	});

	var loader = new jsenvLoader();

	function updateLoaderBase(){
		loader.baseURL = new URL(jsenv.baseURL, jsenv.baseURI);
		jsenv.baseURL = loader.baseURL;
	}

	jsenv.loader = loader;
	jsenv.store = store;
	jsenv.media = mediaHandler;

	// default behaviour is to throw the error
	jsenv.onmoduleerror = function(module, error){
		throw error;
	};

	jsenv.onerror = function(error){
		if( error.filename /*&& (error.name === 'SyntaxError' || error.name === 'ReferenceError')*/ ){
			var module = this.findModuleByURL(error.filename);

			if( module ){
				jsenv.onmoduleerror(module, error);
				return;
			}
		}

		throw error;
	};

	jsenv.findModuleByURL = function(url){
		var found;

		this.forOf(jsenv.loader.values(), function(module){
			var location = String(module.address);

			if( location === url ){
				found = module;
				return true;
			}
		});

		return found;
	};

	jsenv.findModule = function(fn, bind){
		var found;

		this.forOf(jsenv.loader.values(), function(module){
			if( fn.call(bind, module) === true ){
				found = module;
				return true;
			}
		});

		return found;
	};

	jsenv.findModuleBy = function(property, value){
		return this.findModule(function(module){
			return module[property] == value;
		});
	};

	jsenv.include = function(normalizedName, options){
		//if( normalizedName.slice(-3) != '.js' ) normalizedName+= '.js';

		var module = this.loader.createModule(normalizedName, options);

		return module.toPromise().then(function(){
			module.parse();
			module.execute();
			return module.value;
		}).catch(function(error){
			// return a promise that will be rejected when onerror is called
			return new Promise(function(resolve, reject){
				// setImmediate to prevent promise catching the throw
				setImmediate(function(){
					jsenv.onerror(error);
					reject(error);
				});
			});
		}).catch(function(){
			// consider the error as handled (unhandled promise rejection)
		});
	};
	jsenv.chbase = function(uri){
		console.log('chbase', this.baseURI, '->', uri);
		this.baseURI = uri;
		updateLoaderBase();
	};

	jsenv.need('media-js');
	//jsenv.need('media-css');

	jsenv.define('loader');
	jsenv.ready(function setupLoaderBase(){
		updateLoaderBase();
		debug('loader baseURL', loader.baseURL);
	});

	jsenv.ready(function setupLoaderMode(){
		loader.mode = jsenv.mode;
		if( !loader.mode ){
			throw new Error('loader.mode not set');
		}
	});

	jsenv.ready(function setupMedias(){
		debug('supported medias :', Object.keys(mediaHandler.medias));
	});

})(jsenv);