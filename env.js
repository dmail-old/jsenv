/*

inspiration:

https://github.com/kriszyp/nodules
https://github.com/ModuleLoader/es6-module-loader/blob/master/src/system.js

https://github.com/ModuleLoader/es6-module-loader/blob/master/src/loader.js#L885
https://gist.github.com/dherman/7568080
https://github.com/ModuleLoader/es6-module-loader/wiki/Extending-the-ES6-Loader

let baseurl be document relative : https://github.com/systemjs/systemjs/blob/master/lib/extension-core.js

on utiliseras ça surement, ça permet des choses comme
ENV.paths['lodash'] = '/js/lodash.js';
ENV.paths['lodash/*'] = '/js/lodash/*.js';
ENV.locate('lodash'); /js/lodash.js
ENV.locate('lodash/map'); /js/lodash/map.js

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
		return require('path').relative(ENV.baseUrl, filepath);
	}

	function debug(){
		var args = Array.prototype.slice.call(arguments);

		args = args.map(function(arg){
			if( arg instanceof Module ){
				arg = arg.name ? arg.name : 'anonymous module';
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
			var result = this.loader.collectDependencies(this);

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
		module: function(source, options){
			var module = this.createModule();

			// prevent locate()
			if( options && options.address ){
				module.address = options.address;
			}
			// prevent fetch()
			module.source = source;

			return module.then(function(){
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
		constructor: function(name, options){
			this.name = String(name);
			if( options ){
				Object.assign(this, options);
			}
		},

		toString: function(){
			return '[Platform ' + this.name + ']';
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
		},

		init: function(){
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
			'setImmediate', // because required by promise
			'Symbol', // because required by iterator
			'Iterator', // because required by promise.all
			'Promise' // because it's amazing
		],

		createPlatform: function(name, options){
			return new Platform(name, options);
		},

		definePlatform: function(name, options){
			var platform = this.createPlatform(name, options);
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

		getRequirement: function(){
			throw new Error('getRequirement() not implemented');
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
						var requirementUrl = '/polyfill/' + requirement + '.js';
						self.getRequirement(requirementUrl, fulFillRequirement);
					}					
				}
			}

			nextRequirement();
		},

		setup: function(){
			// on pourrait utiliser du JSON ptet
			debug('loading env.global.js');

			// global is required
			this.include('/env.global.js').then(function(){
				// local is optionnal
				debug('loading env.local.js');

				return this.include('/env.local.js').catch(function(error){
					if( error && error.code === 'MODULE_NOT_FOUND' ) return;
					return Promise.reject(error);
				});
			}.bind(this)).then(function(){
				this.platform.setup.call(this);
			});
		},

		init: function(){
			this.platform = this.findPlatform();

			if( this.platform == null ){
				throw new Error('your javascript environment in not supported');
			}

			[
				'getGlobal',
				'getSupportedProtocols',
				'getBaseUrl',
				'request',
				'getRequirement'
			].forEach(function(name){
				this[name] = this.platform[name];
			}, this);

			this.global = this.getGlobal();
			this.global[this.globalName] = this;

			if( this.request ){
				this.protocols.http = this.protocols.https = function(url){
					return this.request(url, {
						method: 'GET'
					});
				};
				/*
				live example
				var giturl = 'https://api.github.com/repos/dmail/argv/contents/index.js?ref=master';
				var xhr = new XMLHttpRequest();

				xhr.open('GET', giturl);
				xhr.setRequestHeader('accept', 'application/vnd.github.v3.raw');
				xhr.send(null);
				*/
				this.protocols.git = function(url){
					var parsed = this.parseURI(url);
					var giturl = replace('https://api.github.com/repos/{user}/{repo}/contents/{path}{search}', {
						user: parsed.username,
						repo: parsed.host,
						path: parsed.pathname || 'index.js',
						search: parsed.search
					});

					return this.request(giturl, {
						method: 'GET',
						headers: {
							'accept': 'application/vnd.github.v3.raw'
						}
					});
				};
			}

			Object.assign(this.protocols, this.getSupportedProtocols());
			this.baseUrl = this.getBaseUrl();

			this.polyfillRequirements();
		},

		normalize: function(name, contextName, contextAddress){
			if( typeof name != 'string' ){
				throw new TypeError('Module name must be a string');
			}

			var segments = name.split('/');

			if( segments.length === 0 ){
				throw new TypeError('No module name provided');
			}

			// current segment
			var i = 0;
			// is the module name relative
			var rel = false;
			// number of backtracking segments
			var dotdots = 0;

			if( segments[0] == '.' ){
				i++;
				if( i == segments.length ){
					throw new TypeError('Illegal module name "' + name + '"');
				}
				rel = true;
			}
			else{
				while( segments[i] == '..' ){
					i++;
					if( i == segments.length ){
						throw new TypeError('Illegal module name "' + name + '"');
					}
				}
				if( i ){
					rel = true;
				}
				dotdots = i;
			}

			var j = i, segment;
			for(;j<segments.length;j++){
				segment = segments[j];
				if( segment === '' || segment == '.' || segment == '..' ){
					throw new TypeError('Illegal module name "' + name + '"');
				}
			}

			if( !rel ){
				return name;
			}

			// build the full module name
			var normalizedParts = [];
			var parentParts = (contextAddress || contextName || '').split('/');
			var normalizedLen = parentParts.length - 1 - dotdots;

			normalizedParts = normalizedParts.concat(parentParts.splice(0, parentParts.length - 1 - dotdots));
			normalizedParts = normalizedParts.concat(segments.splice(i, segments.length - i));

			debug('normalizing', name, contextName, contextAddress, 'to', normalizedParts.join('/'));

			return normalizedParts.join('/');
		},

		// https://gist.github.com/Yaffle/1088850
		parseURI: function(url){
			url = String(url);
			url = url.replace(/^\s+|\s+$/g, ''); // trim

			var regex = /^([^:\/?#]+:)?(\/\/(?:[^:@\/?#]*(?::[^:@\/?#]*)?@)?(([^:\/?#]*)(?::(\d*))?))?([^?#]*)(\?[^#]*)?(#[\s\S]*)?/;
			var match = url.match(regex);
			// authority = '//' + user + ':' + pass '@' + hostname + ':' port
			var parsed = null;

			if( match ){
				parsed = {
					href     : match[0] || '',
					protocol : match[1] || '',
					authority: match[2] || '',
					host     : match[3] || '',
					hostname : match[4] || '',
					port     : match[5] || '',
					pathname : match[6] || '',
					search   : match[7] || '',
					hash     : match[8] || '',
					toString: function(){
						return this.href;
					}
				};
			}

			return parsed;
		},

		toAbsoluteURL: (function(){
			function forceExtension(pathname, extension){
				if( pathname.slice(-(extension.length)) != extension ){
					pathname+= extension;
				}
				return pathname;
			}

			function removeDotSegments(input){
				var output = [];

				input
				.replace(/^(\.\.?(\/|$))+/, '')
				.replace(/\/(\.(\/|$))+/g, '/')
				.replace(/\/\.\.$/, '/../')
				.replace(/\/?[^\/]*/g, function(p){
					if( p === '/..' )
						output.pop();
					else
						output.push(p);
				});

				return output.join('').replace(/^\//, input.charAt(0) === '/' ? '/' : '');
			}

			function toAbsoluteURL(base, href){
				href = this.parseURI(href || '');
				base = this.parseURI(base || '');

				var absoluteUrl = null;

				if( href && base ){
					absoluteUrl =
					(href.protocol || base.protocol) +
					(href.protocol || href.authority ? href.authority : base.authority) +
					forceExtension(
						removeDotSegments(
							href.protocol || href.authority || href.pathname.charAt(0) === '/' ? href.pathname :
							(href.pathname ? ((base.authority && !base.pathname ? '/' : '') +
							base.pathname.slice(0, base.pathname.lastIndexOf('/') + 1) + href.pathname) : base.pathname)
						),
						this.extension
					)+
					(href.protocol || href.authority || href.pathname ? href.search : (href.search || base.search)) +
					href.hash;
				}

				return absoluteUrl;
			}

			return toAbsoluteURL;
		})(),

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

			return meta;
		},

		locate: function(module){
			var meta = this.findMeta(module.name);
			var path = meta.path;
			var address = this.toAbsoluteURL(this.baseUrl, path);

			Object.assign(module.meta, meta);
			module.location = this.parseURI(address);

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

			module.dirname = dirname;
			module.filename = filename;
			module.extension = extension;

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
			var href = location.href;

			if( false === protocol in this.protocols ){
				throw new Error('The protocol "' + protocol + '" is not supported');
			}

			return this.protocols[protocol](href).then(function(response){
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

		getBaseUrl: function(){
			var href = window.location.href.split('#')[0].split('?')[0];
			var baseUrl = href.slice(0, href.lastIndexOf('/') + 1);

			return baseUrl;
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

				xhr.onreadystatechange = function(){
					if( xhr.readyState === 4 ){
						resolve({
							status: xhr.status,
							body: xhr.responseText,
							headers: parseHeaders(xhr.getAllResponseHeaders())
						});
					}
				};			
				xhr.send(options.body || null);
			});
		},

		getSupportedProtocols: function(){
			var protocols = {};

			protocols.file = function(url){
				return protocols.http(url).then(function(response){
					// fix for browsers returning status == 0 for local file request
					if( response.status === 0 ){
						response.status = response.body ? 200 : 404;
					}
					return response;
				});
			};

			return protocols;
		},

		// browser must include script tag with the requirement
		getRequirement: function(url, done){
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
				document.removeEventListener("DOMContentLoaded", completed);
				window.removeEventListener("load", completed);
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

	ENV.definePlatform('server', {
		test: function(){
			return typeof process !== 'undefined';
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
			});
		},

		// For POST, PATCH, PUT, and DELETE requests,
		// parameters not included in the URL should be encoded as JSON with a Content-Type of ‘application/json’
		getSupportedProtocols: function(){
			var protocols = {};

			protocols.http = protocols.https = function(url){
				return this.request(url, {
					method: 'GET'
				});
			};

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

		// in node env requires it
		getRequirement: function(url, done){
			var error = null;

			try{
				require(__dirname + '/' + url);
			}
			catch(e){
				error = e;
			}

			done(error);
		},

		setup: function(){
			if( require.main === module && process.argv.length > 2 ){
				var name = String(process.argv[2]);
				this.include(name).catch(function(error){
					console.error(error.stack);
				});
			}
		}
	});

	ENV.init();

})();