/* globals create, debug, extend */

(function(jsenv){
	// object representing an attempt to locate/fetch/translate/parse a module
	var Module = create({
		mode: 'run', // 'install', 'update', 'run'

		loader: null, // loader used to load this module
		status: null, // loading, loaded, failed
		meta: null,
		name: undefined, // the normalized module name, can be undefined for anonymous modules

		address: null, // result of locate()
		body: null, // result of fetch()
		source: null, // result of translate()
		dependencies: null, // result of collectDependencies()
		parsed: null, // result of parse()
		value: undefined, // result of execute()

		dependents: null, // set from dependencies

		exception: null, // why fetch() failed
		promise: null, // the promise representing the attempt to get the module

		constructor: function(loader, normalizedName){
			var module;

			if( false === loader instanceof ES6Loader ){
				throw new Error('loader expected when creating a module');
			}

			if( normalizedName && loader.has(normalizedName) ){
				module = loader.get(normalizedName);
			}
			// create a load
			else{
				module = this;
				module.loader = loader;
				module.status = 'loading';
				module.meta = {};
				module.dependencies = [];
				module.dependents = [];

				if( normalizedName ){
					module.name = normalizedName;
					loader.modules[normalizedName] = module;
				}
			}

			return module;
		},

		toString: function(){
			return '[Module '+ this.name +']';
		},

		locate: function(){
			this.step = 'locate';

			debug('locate', this);

			var promise;

			if( this.hasOwnProperty('address') ){
				promise = Promise.resolve(this.address);
			}
			else{
				promise = Promise.resolve(this.loader.locate(this)).then(function(address){
					this.address = address;
					return address;
				}.bind(this));
			}

			return promise;
		},

		fetch: function(){
			this.step = 'fetch';

			debug('fetch', this);

			var promise;

			if( this.hasOwnProperty('body') ){
				promise = Promise.resolve(this.body);
			}
			else{
				promise = this.loader.fetch(this).then(function(body){
					this.body = body;
					return body;
				}.bind(this));
			}

			return promise;
		},

		translate: function(){
			this.step = 'translate';

			var promise;

			if( this.hasOwnProperty('source') ){
				promise = Promise.resolve(this.source);
			}
			else{
				promise = Promise.resolve(this.loader.translate(this)).then(function(source){
					this.source = source;
					return source;
				}.bind(this));
			}

			return promise.then(function(){
				this.status = 'loaded';
			}.bind(this));
		},

		declareDependency: function(name){
			var normalizedName = this.loader.normalize(name, this.name, String(this.address));
			var moduleDependency = this.loader.createModule(normalizedName);

			if( moduleDependency === this ){
				throw new Error(this + ' cannot depends on himself');
			}
			if( this.dependents.indexOf(moduleDependency) !== -1 ){
				throw new Error(this + ' is dependant of ' + moduleDependency);
			}

			debug(this, 'depends on', moduleDependency);

			if( this.dependencies.indexOf(moduleDependency) === -1 ){
				this.dependencies.push(moduleDependency);
			}
			if( moduleDependency.dependents.indexOf(this) === -1 ){
				moduleDependency.dependents.push(this);
			}

			return moduleDependency;
		},

		collectDependencies: function(){
			var result = this.meta.dependencies || this.loader.collectDependencies(this);

			if( result === undefined ){
				throw new TypeError('native es6 modules instantiation not supported');
			}
			else if( Object(result) === result ){
				if( result.length ){
					debug(this, 'has the following dependencies in source', result.map(String));
					result.forEach(this.declareDependency, this);
				}
				else{
					debug(this, 'has no dependency');
				}
			}
			else{
				throw new TypeError('instantiate hook must return an object or undefined');
			}
		},

		loadDependencies: function(){
			// modules are thenable dependencies array is already an array of promise
			var loadPromises = this.dependencies;
			return Promise.all(this.dependencies);
		},

		parse: function(module){
			var parsed;

			if( this.hasOwnProperty('parsed') ){
				parsed = this.parsed;
			}
			else{
				parsed = this.loader.parse(this);
				this.parsed = parsed;
			}

			return parsed;
		},

		execute: function(){
			var value;

			if( this.hasOwnProperty('value') ){
				value = this.value;
			}
			else{
				value = this.loader.execute(this);
				this.value = value;
				debug('executed', this, 'getting a value of type', typeof value);
			}

			return value;
		},

		include: function(name){
			var normalizedName = this.loader.normalize(name, this.name, this.address), module;

			module = this.loader.get(normalizedName);

			if( module == null ){
				throw new Error(this.name + ' includes ' + normalizedName + ', but the module cannot be found');
			}

			return module.value;
		},

		createPromise: function(){
			var promise = Promise.resolve();

			[
				this.locate,
				this.fetch,
				this.translate,
				this.collectDependencies,
				this.loadDependencies
			].forEach(function(method){
				promise = promise.then(method.bind(this));
			}, this);

			promise = promise.catch(function(error){
				this.status = 'failed';
				this.exception = error;
				return Promise.reject(error);
			}.bind(this));

			this.promise = promise;

			return promise;
		},

		toPromise: function(){
			var promise;

			if( this.hasOwnProperty('promise') ){
				promise = this.promise;
			}
			else{
				promise = this.createPromise();
			}

			return promise;
		},

		then: function(onResolve, onReject){
			return this.toPromise().then(onResolve, onReject);
		}
	});

	var ES6Loader = create({
		modules: null, // module registry

		constructor: function(options){
			if( options ){
				Object.assign(this, options);
			}

			this.modules = {};
		},

		createModuleNotFoundError: function(location){
			var error = new Error('module not found ' + location);
			error.code = 'MODULE_NOT_FOUND';
			return error;
		},

		normalize: function(name, contextName, contextAddress){
			return name;
		},

		locate: function(module){
			return module.name;
		},

		fetch: function(module){
			throw new TypeError('fetch not implemented');
		},

		translate: function(module){
			return module.body;
		},

		collectDependencies: function(){

		},

		parse: function(module){
			return module.source;
		},

		execute: function(module){
			return undefined;
		},

		get: function(normalizedName){
			var module;

			if( this.has(normalizedName) ){
				module = this.modules[normalizedName];

				// ensure module is evaluated (parsed & executed
				module.parse();
				module.execute();
			}

			return module;
		},

		has: function(normalizedName){
			return normalizedName in this.modules;
		},

		set: function(normalizedName, module){
			if( false === module instanceof Module ){
				throw new TypeError('Loader.set(' + normalizedName + ', module) must be a module');
			}
			this.modules[normalizedName] = module;
		},

		delete: function(normalizedName){
			if( this.has(normalizedName) ){
				delete this.modules[normalizedName];
				return true;
			}
			return false;
		},

		entries: function(){ return new Iterator(this.modules, 'key+value'); },
		keys: function(){ return new Iterator(this.modules, 'key'); },
		values: function(){ return new Iterator(this.modules, 'value'); },

		createModule: function(normalizedName){
			return new Module(this, normalizedName);
		},

		define: function(normalizedName, source, options){
			normalizedName = String(normalizedName);
			// replace any existing module with the defined one
			if( this.has(normalizedName) ){
				this.delete(normalizedName);
			}

			var module = this.createModule(normalizedName);

			module.address = normalizedName; // prevent locate()
			module.source = source; // prevent fetch()

			if( options ){
				if( options.meta ){
					module.meta = options.meta;
				}
				if( options.address ){
					module.address = options.address;
				}
			}

			return Promise.resolve(module).then(function(){});
		},

		load: function(normalizedName, options){
			normalizedName = String(normalizedName);

			var module = this.createModule(normalizedName);

			// prevent locate()
			if( options && options.address ){
				module.address = options.address;
			}

			return Promise.resolve(module);
		},

		// execute a top level anonymous module, not registering it
		module: function(body, options){
			var module = this.createModule();

			// prevent locate()
			if( options && options.address ){
				module.address = options.address;
			}
			else{
				module.address = '';
			}
			// prevent fetch() but not translate
			module.body = body;

			console.log('body of anonymous module is', body);

			return module.then(function(){
				module.parse();
				module.execute();
				return module;
			});
		}
	});

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

	var jsenvLoader = extend(ES6Loader, {
		constructor: function(env, options){
			ES6Loader.call(this, options);
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

			if( firstChar === '.' && contextAddress ){
				if( contextAddress.match(absURLRegEx) ){
					normalizedName = new URI(name, contextAddress);
				}
				else{
					normalizedName = resolvePath(name, contextAddress);
				}
			}
			else if( firstChar === '.' || firstChar === '/' ){
				normalizedName = new URI(name, this.baseURL);
			}
			else{
				normalizedName = name;
			}

			normalizedName = String(normalizedName);
			debug('normalizing', name, contextAddress, String(contextAddress), 'to', normalizedName);

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

			debug('localized', name, 'at', String(address));
			debug('origin of', name, 'is', module.meta.origin);

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

			var promise = sourceStorage.get(sourceLocation, {});
			// install mode react on 404 to project by read origin & write source
			if( module.mode === 'install' ){
				promise = promise.then(function(response){
					if( response.status != 404 ) return response;

					var originLocation = module.meta.origin;
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
						return sourceStorage.set(sourceLocation, response.body, {}).then(function(){
							return response;
						});
					});
				}.bind(this));
			}
			// update mode react on 200 to project by read at from & write at to when from is more recent
			else if( module.mode === 'update' ){
				promise = promise.then(function(response){
					if( response.status != 200 ) return response;

					var from = module.meta.from;
					if( !from ) return response;

					var fromStorage = this.findStorage(from);
					var request = {
						mtime:  module.meta.mtime
					};

					var fromPromise = fromStorage.get(from, request);

					if( sourceStorage.set ){
						fromPromise = fromPromise.then(function(response){
							if( response.status != 200 ) return response; // only on 200 status
							return sourceStorage.set(sourceLocation, response.body, {}).then(function(){
								return response;
							});
						});
					}

					return fromPromise;
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

})(jsenv);