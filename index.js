/*

inspiration:

https://github.com/kriszyp/nodules
https://github.com/ModuleLoader/es6-module-loader/blob/master/src/system.js

https://github.com/ModuleLoader/es6-module-loader/blob/master/src/loader.js#L885
https://gist.github.com/dherman/7568080
https://github.com/ModuleLoader/es6-module-loader/wiki/Extending-the-ES6-Loader

*/

if( !Object.assign ){
	Object.assign = function(object){
		var i = 1, j = arguments.length, owner, keys, n, m, key;

		for(;i<j;i++){
			owner = arguments[i];
			if( Object(owner) != owner ) continue;
			keys = Object.keys(owner);
			n = 0;
			m = keys.length;

			for(;n<m;n++){
				key = keys[n];
				object[key] = owner[key];
			}
		}
	};
}

function forOf(iterable, fn, bind){
	var method, iterator, next;

	method = iterable[Symbol.iterator];

	if( typeof method !== 'function' ){
		throw new TypeError(iterable + 'is not iterable');
	}

	if( typeof fn != 'function' ){
		throw new TypeError('second argument must be a function');
	}

	iterator = method.call(iterable);
	next = iterator.next();
	while( next.done === false ){
		if( fn.call(bind, next.value) === true ){
			if( typeof iterator['return'] === 'function' ){
				iterator['return']();
			}
			break;
		}
		next = iterator.next();
	}

	return this;
}

(function(){
	function shortenPath(filepath){
		return require('path').relative(ENV.baseURI, filepath);
	}

	function debug(){
		var args = Array.prototype.slice.call(arguments);

		args = args.map(function(arg){
			if( arg instanceof Module ){
				arg = arg.name ? String(arg.name) : 'anonymous module';
			}
			return arg;
		});

		console.log.apply(console, args);
	}

	function create(proto){
		proto.constructor.prototype = proto;
		return proto.constructor;
	}

	function replace(string, values){
		return string.replace((/\\?\{([^{}]+)\}/g), function(match, name){
			if( match.charAt(0) == '\\' ) return match.slice(1);
			return (values[name] != null) ? values[name] : '';
		});
	}

	// object representing an attempt to locate/fetch/translate/parse a module
	var Module = create({
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
			var normalizedName = this.loader.normalize(name, this.name, this.address);
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

			return module.locate().then(function(){
				return module.fetch();
			});
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
		},

		include: function(normalizedName, options){
			normalizedName = String(normalizedName);

			var module = this.createModule(normalizedName);

			// prevent locate()
			if( options && options.address ){
				module.address = options.address;
			}

			return module.then(function(){
				module.parse();
				module.execute();
				return module;
			});
		}
	});

	var Platform = create({
		constructor: function(type, options){
			this.type = String(type);
			if( options ){
				Object.assign(this, options);
			}
		},

		toString: function(){
			return '[Platform ' + this.type + ']';
		},

		getGlobal: function(){
			return undefined;
		},

		getSupportedProtocols: function(){
			return {};
		},

		getBaseUrl: function(){
			return '';
		},

		setup: function(){
			// noop
		}
	});

	var ENV = new ES6Loader({
		platforms: [],
		platform: null,

		globalName: 'ENV',
		global: null,
		protocols: {},
		baseUrl: null,
		extension: '.js',
		configs: [],
		requirements: [
			'URI',
			'setImmediate', // because required by promise
			'Symbol', // because required by iterator
			'Iterator', // because required by promise.all
			'Promise' // because it's amazing
		],

		createPlatform: function(type, options){
			return new Platform(type, options);
		},

		definePlatform: function(type, options){
			var platform = this.createPlatform(type, options);
			this.platforms.push(platform);
			return platform;
		},

		findPlatform: function(){
			var platforms = this.platforms, i = platforms.length, platform = null;

			while(i--){
				platform = platforms[i];
				if( platform.test.call(this) ){
					break;
				}
				else{
					platform = null;
				}
			}

			return platform;
		},

		hasRequirement: function(requirement){
			return requirement in this.global;
		},

		getRequirement: function(scriptUrl, done){
			return this.platform.loadScript(scriptUrl, done);
		},

		polyfillRequirements: function(){
			this.global.forOf = this.forOf = forOf;

			var self = this, requirements = this.requirements, i = 0, j = requirements.length, requirement;

			function fulFillRequirement(error){
				if( error ){
					throw new Error('An error occured during requirement load' +  error);
				}
				if( !self.hasRequirement(requirement) ){
					throw new Error('getRequirement() did not fulfill ' + requirement + ' (not found in global)');
				}
				nextRequirement();
			}

			function nextRequirement(){
				if( i >= j ){
					debug('all requirements fullfilled, calling setup phase');
					self.setup();
				}
				else{
					requirement = requirements[i];
					i++;

					if( self.hasRequirement(requirement) ){
						debug('already got the requirement', requirement);
						nextRequirement();
					}
					else{
						debug('get the requirement', requirement);
						// '/test.js' mean relative to the root while './test.js' means relative to the base
						var requirementUrl = self.platform.dirname + '/polyfill/' + requirement + '.js';
						self.getRequirement(requirementUrl, fulFillRequirement);
					}
				}
			}

			nextRequirement();
		},

		setup: function(){
			this.include('./env.global.js').then(function(){
				debug('loading env.local.js');

				return this.include('./env.local.js').catch(function(error){
					if( error && error.code === 'MODULE_NOT_FOUND' ) return;
					return Promise.reject(error);
				});
			}.bind(this)).then(function(){
				console.log('setup platform', this.platform.name);
				this.platform.setup.call(this);
			}.bind(this));
		},

		httpRequest: function(url){
			return this.platform.request(url, {
				method: 'GET'
			});
		},

		/*
		live example
		var giturl = 'https://api.github.com/repos/dmail/argv/contents/index.js?ref=master';
		var xhr = new XMLHttpRequest();
		var date = new Date();
		date.setMonth(0);

		xhr.open('GET', giturl);
		xhr.setRequestHeader('accept', 'application/vnd.github.v3.raw');
		xhr.setRequestHeader('if-modified-since', date.toUTCString());
		xhr.send(null);
		*/
		githubRequest: function(url){
			var parsed = new URI(url);
			var version = parsed.hash ? parsed.hash.slice(1) : 'master';
			if( version === 'latest' ) version = 'master';
			var giturl = replace('https://api.github.com/repos/{user}/{repo}/contents/{path}?ref={version}', {
				user: parsed.username,
				repo: parsed.host,
				path: parsed.pathname ? parsed.pathname.slice(1) : 'index.js',
				version: version
			});

			return this.platform.request(giturl, {
				method: 'GET',
				headers: {
					'accept': 'application/vnd.github.v3.raw',
					'User-Agent': 'jsenv' // https://developer.github.com/changes/2013-04-24-user-agent-required/
				}
			});
		},

		init: function(){
			this.platform = this.findPlatform();

			if( this.platform == null ){
				throw new Error('your javascript environment in not supported');
			}

			this.platform.name = this.platform.getName();
			this.platform.version = this.platform.getVersion();

			debug('platform :', this.platform.type, '(', this.platform.name, this.platform.version, ')');

			this.platform.global = this.platform.getGlobal();
			this.platform.protocols = this.platform.getSupportedProtocols();
			this.platform.baseURL = this.platform.getBaseUrl();
			this.platform.filename = this.platform.getSrc();
			this.platform.dirname = this.platform.filename.slice(0, this.platform.filename.lastIndexOf('/'));

			this.global = this.platform.global;
			this.global[this.globalName] = this;
			//this.request = this.platform.request.bind(this);

			if( this.platform.request ){
				this.protocols.http = this.protocols.https = this.httpRequest;
				this.protocols.github = this.githubRequest;
			}

			Object.assign(this.protocols, this.platform.protocols);
			this.baseURI = this.platform.baseURL;
			this.baseURL = this.platform.baseURL; // allow baseurl to be relative to baseURI

			this.polyfillRequirements();
		},

		getConfig: function(selector){
			var configs = this.configs, i = 0, j = configs.length, config;

			for(;i<j;i++){
				config = configs[i];
				if( config.selector === selector ) break;
				else config = null;
			}

			return config;
		},

		config: function(selector, properties){
			var config = this.getConfig(selector);

			if( config ){
				Object.assign(config.properties, properties);
			}
			else{
				this.configs.push({
					selector: selector,
					properties: properties
				});
				// keep config sorted (the most specific config is the last applied)
				this.configs = this.configs.sort(function(a, b){
					return (a.path ? a.path.length : 0) - (b.path ? b.path.length : 0);
				});
			}
		},

		matchSelector: function(name, selector){
			var starIndex = selector.indexOf('*'), match = false;

			if( starIndex === -1 ){
				if( name === selector ){
					match =  true;
				}
			}
			else{
				var left = selector.slice(0, starIndex), right = selector.slice(starIndex + 1);
				var nameLeft = name.slice(0, left.length), nameRight = name.slice(name.length - right.length);

				if( left == nameLeft && right == nameRight ){
					match = name.slice(left.length, name.length - right.length);
				}
			}

			return match;
		},

		findMeta: function(normalizedName){
			var meta = {path: normalizedName}, match;

			this.configs.forEach(function(config){
				match = this.matchSelector(normalizedName, config.selector);
				if( match ){
					Object.assign(meta, config.properties);

					if( typeof match === 'string' ){
						for(var key in meta){
							meta[key] = meta[key].replace('*', match);
						}
					}
				}
			}, this);

			// for wildcard match, add main only if the normalizedName does not contains '/' after the match
			if( meta.main && (!match || typeof match != 'string' || match.indexOf('/') === -1) ){
				meta.path+= '/' + meta.main;
			}

			return meta;
		},

		// https://github.com/systemjs/systemjs/blob/5ed14adca58abd3cf6c29783abd53af00b0c5bff/lib/package.js#L80
		// for package, we have to know the main entry
		normalize: function(name, contextName, contextAddress){
			var absURLRegEx = /^([^\/]+:\/\/|\/)/;
			var normalizedName;

			function resolve(name, parentName){
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

			if( name === '.' && contextName ){
				if( contextName.match(absURLRegEx) ){
					normalizedName = new URI(name, contextName);
				}
				else{
					normalizedName = resolve(name, contextName);
				}
			}
			else if( name[0] === '.' || name[0] === '/' ){
				normalizedName = new URI(name, this.baseURL);
			}

			normalizedName = String(normalizedName);
			debug('normalizing', name, contextName, String(contextAddress), 'to', normalizedName);

			return normalizedName;
		},

		// https://github.com/systemjs/systemjs/blob/0.17/lib/core.js
		locate: function(module){
			var absURLRegEx = /^([^\/]+:\/\/|\/)/;
			var name = module.name;
			var address;
			var meta = this.findMeta(name);

			if( name.match(absURLRegEx) ){
				address = new URI(name);
			}
			else{
				address = new URI(meta.path, this.baseURL);
			}

			Object.assign(module.meta, meta);
			module.location = address;

			var pathname = module.location.pathname;
			var slashLastIndexOf = pathname.lastIndexOf('/');
			var dirname, filename, extension;

			if( slashLastIndexOf === -1 ){
				dirname = '.';
				filename = pathname;
			}
			else{
				dirname = pathname.slice(0, slashLastIndexOf);
				filename = pathname.slice(slashLastIndexOf + 1);
			}

			var dotLastIndexOf = filename.lastIndexOf('.');

			if( dotLastIndexOf === -1 ){
				extension = '';
			}
			else{
				extension = filename.slice(dotLastIndexOf);
			}

			if( extension != this.extension ){
				extension = this.extension;
				address.pathname+= this.extension;
			}

			module.dirname = dirname;
			module.filename = filename;
			module.extension = extension;

			debug('localized', module.name, 'at', String(address));

			return address;
		},

		createModuleNotFoundError: function(location){
			var error = new Error('module not found ' + location);
			error.code = 'MODULE_NOT_FOUND';
			return error;
		},

		fetch: function(module){
			var location = module.location;
			var protocol = location.protocol.slice(0, -1); // remove ':' from 'file:'
			var href = String(location);

			if( false === protocol in this.protocols ){
				throw new Error('The protocol "' + protocol + '" is not supported');
			}

			if( typeof href != 'string' ){
				throw new TypeError('module url must a a string ' + href);
			}

			return this.protocols[protocol].call(this, href).then(function(response){
				if( response.status === 404 ){
					throw this.createModuleNotFoundError(module.location);
				}
				else if( response.status != 200 ){
					throw new Error('fetch failed with response status: ' + response.status);
				}

				return response.body;
			}.bind(this));
		},

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
			if( url ) code+= '\n//# sourceURL=' + url;
			return eval(code);
		},

		parse: function(module){
			return this.eval('(function(module, include){\n\n' + module.source + '\n\n})', module.address);
		},

		execute: function(module){
			return module.parsed.call(this.global, module, module.include.bind(module));
		}
	});

	ENV.definePlatform('browser', {
		test: function(){
			return typeof window !== 'undefined';
		},

		getGlobal: function(){
			return window;
		},

		getSrc: function(){
			return document.scripts[document.scripts.length - 1].src;
		},

		getAgent: function(){
			var ua = navigator.userAgent.toLowerCase();
			var regex = /(opera|ie|firefox|chrome|version)[\s\/:]([\w\d\.]+)?.*?(safari|version[\s\/:]([\w\d\.]+)|$)/;
			var UA = ua.match(regex) || [null, 'unknown', 0];
			var name = UA[1] == 'version' ? UA[3] : UA[1];
			var version;

			// version
			if( UA[1] == 'ie' && document.documentMode ) version = true;
			else if( UA[1] == 'opera' && UA[4] ) version = parseFloat(UA[4]);
			else version = parseFloat(UA[2]);

			return {
				name: name,
				version: version
			};
		},

		getName: function(){
			return this.getAgent().name;
		},

		getVersion: function(){
			return this.getAgent().version;
		},

		getOs: function(){
			return navigator.platform.toLowerCase();
		},

		getBaseUrl: function(){
			var href = window.location.href.split('#')[0].split('?')[0];
			var baseUrl = href.slice(0, href.lastIndexOf('/') + 1);

			return baseUrl;
		},

		// browser must include script tag with the requirement
		loadScript: function(url, done){
			var script = document.createElement('script');

			script.src = url;
			script.type = 'text/javascript';
			script.onload = function(){
				done();
			};
			script.onerror = function(error){
				done(error);
			};

			document.head.appendChild(script);
		},

		request: function(url, options){
			// https://gist.github.com/mmazer/5404301
			function parseHeaders(headerString){
				var headers = {}, pairs, pair, index, i, j, key, value;

				if( headerString ){
					pairs = headerString.split('\u000d\u000a');
					i = 0;
					j = pairs.length;
					for(;i<j;i++){
						pair = pairs[i];
						index = pair.indexOf('\u003a\u0020');
						if( index > 0 ){
							key = pair.slice(0, index);
							value = pair.slice(index + 2);
							headers[key] = value;
						}
					}
				}

				return headers;
			}

			return new Promise(function(resolve, reject){
				var xhr = new XMLHttpRequest();

				xhr.open(options.method, url);
				if( options.headers ){
					for(var key in options.headers){
						xhr.setRequestHeader(key, options.headers[key]);
					}
				}

				xhr.onerror = reject;
				xhr.onreadystatechange = function(){
					if( xhr.readyState === 4 ){
						resolve({
							status: xhr.status,
							body: xhr.responseText,
							headers: parseHeaders(xhr.getAllResponseHeaders())
						});
					}
				};
				try{
				xhr.send(options.body || null);
				}
				catch(e){
					reject(e);
				}
			});
		},

		getSupportedProtocols: function(){
			var protocols = {};

			protocols.file = function(url){
				debug('xhr', url);

				return this.protocols.http.call(this, url).then(function(response){
					// fix for browsers returning status == 0 for local file request
					if( response.status === 0 ){
						response.status = response.body ? 200 : 404;
					}
					return response;
				});
			};

			return protocols;
		},

		setup: function(){
			function ready(){
				var scripts = document.getElementsByTagName('script'), i = 0, j = scripts.length, script;
				for(;i<j;i++){
					script = scripts[i];
					if( script.type === 'module' ){
						ENV.module(script.innerHTML.slice(1)).catch(function(error){
							setTimeout(function(){ throw error; });
						});
					}
				}

				if( ENV.mainModule ){
					ENV.include(ENV.mainModule).catch(console.error);
				}
			}

			function completed(){
				document.removeEventListener('DOMContentLoaded', completed);
				window.removeEventListener('load', completed);
				ready();
			}

			if( document.readyState === 'complete' ){
				setTimeout(ready);
			}
			else if( document.addEventListener ){
				document.addEventListener('DOMContentLoaded', completed);
				window.addEventListener('load', completed);
			}
		}
	});

	ENV.definePlatform('process', {
		test: function(){
			return typeof process !== 'undefined';
		},

		getSrc: function(){
			var src = __filename;

			if( process.platform.match(/^win/) ){
				src = src.replace(/\\/g, '/');
			}

			return src;
		},

		getName: function(){
			return 'node';
		},

		getVersion: function(){
			return process.version;
		},

		getOs: function(){
			// https://nodejs.org/api/process.html#process_process_platform
			// 'darwin', 'freebsd', 'linux', 'sunos', 'win32'
			return process.platform;
		},

		getGlobal: function(){
			return global;
		},

		getBaseUrl: function(){
			var baseUrl = 'file://' + process.cwd() + '/';

			if( process.platform.match(/^win/) ){
				baseUrl = baseUrl.replace(/\\/g, '/');
			}

			return baseUrl;
		},

		// in node env requires it
		loadScript: function(url, done){
			var error = null;

			try{
				require(url);
			}
			catch(e){
				error = e;
			}

			done(error);
		},

		request: function(url, options){
			var http = require('http');
			var https = require('https');
			var parse = require('url').parse;

			var parsed = parse(url), secure;

			Object.assign(options, parsed);

			secure = options.protocol === 'https:';

			options.port = secure ? 443 : 80;

			return new Promise(function(resolve, reject){
				var httpRequest = (secure ? https : http).request(options);

				console.log(options.method, url);

				function resolveWithHttpResponse(httpResponse){
					var buffers = [], length;
					httpResponse.addListener('data', function(chunk){
						buffers.push(chunk);
						length+= chunk.length;
					});
					httpResponse.addListener('end', function(){
						resolve({
							status: httpResponse.statusCode,
							headers: httpResponse.headers,
							body: Buffer.concat(buffers, length).toString()
						});
					});
					httpResponse.addListener('error', reject);
				}

				httpRequest.addListener('response', resolveWithHttpResponse);
				httpRequest.addListener('error', reject);
				httpRequest.addListener('timeout', reject);
				httpRequest.addListener('close', reject);

				if( options.body ){
					httpRequest.write(options.body);
				}
				else{
					httpRequest.end();
				}

				// timeout
				setTimeout(function(){ reject(new Error("Timeout")); }, 20000);
			}).catch(function(error){
				console.log('http request error', error);
				throw error;
			});
		},

		// For POST, PATCH, PUT, and DELETE requests,
		// parameters not included in the URL should be encoded as JSON with a Content-Type of ‘application/json’
		getSupportedProtocols: function(){
			var protocols = {};

			var fs = require('fs');
			function fetchFile(location){
				location = location.slice('file://'.length);

				return new Promise(function(resolve, reject){
					fs.readFile(location, function(error, source){
						if( error ){
							if( error.code == 'ENOENT' ){
								resolve({
									status: 404
								});
							}
							else{
								reject(error);
							}
						}
						else{
							resolve({
								status: 200,
								body: source
							});
						}
					});
				});
			}

			protocols.file = function(location, module){
				return fetchFile(location, module);
			};

			return protocols;
		},

		setup: function(){
			if( require.main === module && process.argv.length > 2 ){
				//var name = String(process.argv[2]);
				//debug('runasmain', name);
				//this.include(name).catch(function(error){
				//	console.error(error.stack);
				//});
			}
		}
	});

	ENV.init();

})();