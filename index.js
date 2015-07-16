/*

inspiration:

https://github.com/kriszyp/nodules
https://github.com/ModuleLoader/es6-module-loader/blob/master/src/system.js
https://github.com/ModuleLoader/es6-module-loader/blob/master/src/loader.js#L885
https://gist.github.com/dherman/7568080
https://github.com/ModuleLoader/es6-module-loader/wiki/Extending-the-ES6-Loader

*/

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

function debug(){
	var args = Array.prototype.slice.call(arguments);

	args = args.map(function(arg){
		if( arg && typeof arg == 'object'){
			if( 'name' in arg ){
				arg = arg.name ? String(arg.name) : 'anonymous module';
			}
			else{
				arg = String(arg);
			}
		}
		return arg;
	});

	console.log.apply(console, args);
}

function mapProperties(args, fn){
	var object = args[0], i = 1, j = args.length, owner, keys, n, m;

	for(;i<j;i++){
		owner = args[i];
		if( Object(owner) != owner ) continue;
		keys = Object.keys(owner);
		n = 0;
		m = keys.length;

		for(;n<m;n++){
			fn(object, keys[n], owner);
		}
	}

	return object;
}

if( !Object.assign ){
	Object.assign = function(){
		return mapProperties(arguments, function(object, key, owner){
			object[key] = owner[key];
		});
	};
}

Object.complete = function(){
	return mapProperties(arguments, function(object, key, owner){
		if( key in object ){
			var current = object[key], value = owner[key];
			if( typeof current === 'object' && typeof value === 'object' ){
				Object.complete(current, value);
			}
			return;
		}

		object[key] = owner[key];
	});
};

Function.create = function(properties){
	var constructor;

	if( properties.hasOwnProperty('constructor') ){
		constructor = properties.constructor;
	}
	else{
		constructor = function(){};
		properties.constructor = constructor;
	}

	constructor.prototype = properties;

	return constructor;
};

Function.extend = function(parentConstructor, properties){
	var constructor, proto;

	if( properties.hasOwnProperty('constructor') ){
		constructor = properties.constructor;
	}
	else{
		constructor = function(){
			return parentConstructor.apply(this, arguments);
		};
		properties.constructor = constructor;
	}
	properties.super = parentConstructor;

	proto = Object.create(parentConstructor.prototype);
	Object.assign(proto, properties);

	constructor.prototype = proto;

	return constructor;
};

(function(){
	// platforms
	var Platform = Function.create({
		constructor: function(env, type, options){
			this.env = env;
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

		getSrc: function(){
			return '';
		},

		getBaseURL: function(){
			return '';
		},

		getName: function(){
			return 'unknown';
		},

		getVersion: function(){
			return '0.0.1';
		},

		getRequirements: function(){
			return [
				'platform-storages'
			];
		},

		setup: function(){

		},

		init: function(){
			this.env.init();
		}
	});

	// requirements
	var Requirement = Function.create({
		location: null,
		loaded: false,
		value: undefined,

		constructor: function(options, callback){
			if( typeof options === 'string' || typeof options === 'function' ){
				options = {location: options};
			}

			Object.assign(this, options);

			if( callback != null ){
				if( typeof callback != 'function' ){
					throw new TypeError('callback must be a function, ' + typeof callback + ' given');
				}
				this.onload = callback;
			}
		},

		onload: function(){

		},

		getLocation: function(){
			var location = this.location;

			location =  location.replace(/{platform}/g, jsenv.platform.type);

			// / means relative to the jsenv dirname here, not the env root
			if( location[0] === '/' ){
				location = jsenv.platform.dirname + location;
			}
			else if( location.slice(0, 2) === './' ){
				location = jsenv.baseURI + location.slice(2);
			}

			return location;
		},

		load: function(listener){
			if( this.loaded ){
				this.onload(this.value);
				listener();
			}
			else if( typeof this.location === 'function' ){
				if( this.location.length === 0 ){
					this.location();
					listener();
				}
				else{
					this.location(function(e){
						if( e ){
							this.fail(e);
						}
						else{
							this.complete();
							listener();
						}
					}.bind(this));
				}
			}
			else{
				//debug('REQUIRE', this.location);
				jsenv.platform.load(this.getLocation(), function(error){
					if( error ){
						this.fail(error);
					}
					else{
						//debug('REQUIRED', this.location);
						this.complete();
						listener();
					}
				}.bind(this));
			}
		},

		complete: function(){
			this.loaded = true;
			this.onload(this.value);
		},

		fail: function(error){
			// in case it's called from a promise
			setTimeout(function(){
				throw error;
			}, 0);
			//new Error('An error occured during requirement loading at ' + this.location + '\n' + error);
		}
	});

	var jsenv = {
		state: 'created',

		// platforms
		platforms: [],
		platform: null,
		globalName: 'jsenv',
		global: null,
		baseURI: null,
		baseURL: './', // relative to baseURI

		readyListeners: [],

		aliases: {
			// dependencies
			'URLSearchParams': '/requirements/URLSearchParams.js',
			'URL': '/requirements/URL.js',
			'setImmediate': '/requirements/setImmediate.js',
			'Symbol': '/requirements/Symbol.js',
			'Iterator': '/requirements/Iterator.js',
			'Promise': '/requirements/Promise.js',

			// lib/loader
			'module': '/lib/loader/module.js',
			'es6-loader': '/lib/loader/es6-loader.js',
			'loader': '/lib/loader/loader.js',
			'store': '/lib/loader/store.js',
			// lib/config
			'config': '/lib/config.js',
			// lib/http
			'duplex-stream': '/lib/http/duplex-stream.js',
			'http-headers': '/lib/http/http-headers.js',
			'http-body': '/lib/http/http-body.js',
			'http-response': '/lib/http/http-response.js',
			'http-request': '/lib/http/http-request.js',
			'http-request-promise': '/lib/http/http-request-promise.js',
			'http-request-platform': '/lib/http/http-request-{platform}.js',
			'http-client': '/lib/http/http-client.js',
			'http-event-stream': '/lib/http/http-event-stream.js',
			'http-event-source': '/lib/http/http-event-source.js',
			'http': '/lib/http/http.js',
			// medias
			'media-js': '/medias/media-js.js',
			'media-css': '/medias/media-css.js',

			// platform
			'platform-storages': '/storages/storages-{platform}.js'
		},

		createPlatform: function(type, options){
			return new Platform(this, type, options);
		},

		findPlatform: function(){
			var platforms = this.platforms, i = platforms.length, platform = null;

			while(i--){
				platform = platforms[i];
				if( platform.is.call(this) ){
					break;
				}
				else{
					platform = null;
				}
			}

			return platform;
		},

		// requirements
		requirements: [],
		requirementIndex: -1,
		requirementLoadIndex: 0,

		has: function(requirementLocation){
			var i = this.requirements.length;
			while(i-- && this.requirements[i].location !== requirementLocation);
			this.requirementIndex = i;
			return i !== -1;
		},

		get: function(requirementLocation){
			var requirement;

			if( this.has(requirementLocation) ){
				requirement = this.requirements[this.requirementIndex];
			}

			return requirement;
		},

		createRequirement: function(requirementLocation, onload){
			return new Requirement(requirementLocation, onload);
		},

		locate: function(requirementName){
			var requirementPath;

			if( requirementName in this.aliases ){
				requirementPath = this.aliases[requirementName];
			}
			else{
				requirementPath = requirementName;
			}

			return requirementPath;
		},

		define: function(requirementName, value){
			var requirementLocation = this.locate(requirementName);
			var requirement = this.get(requirementLocation);

			if( requirement ){
				requirement.loaded = true;
				requirement.value = value;
			}
			else{
				requirement = this.need(requirementLocation);
				requirement.loaded = true;
				requirement.value = value;
				this.requirements.push(requirement);
			}
		},

		require: function(requirementName){
			var requirementLocation = this.locate(requirementName);
			var requirement = this.get(requirementLocation);

			if( requirement ){
				if( requirement.loaded ){
					return requirement.value;
				}
				else{
					throw new Error('requirement not preloaded : ' + requirementName);
				}
			}
			else{
				//requirementLocation = requirementLocation.replace(/{platform}/g, this.platform.type);
				throw new Error('requirement not found : ' + requirementLocation);
			}
		},

		need: function(requirementName){
			var requirementLocation, requirement;

			if( typeof requirementName === 'function' ){
				requirementLocation = requirementName;
			}
			else{
				requirementLocation = this.locate(requirementName);
			}

			requirement = this.get(requirementLocation);

			if( requirement ){
				throw new Error('you can declare a need to ' + requirementLocation + ' once');
			}
			else{
				requirement = this.createRequirement(requirementLocation);

				if( this.state == 'created' ){
					this.requirements.push(requirement);
				}
				else if( this.state == 'loading' ){
					this.requirements.splice(this.requirementLoadIndex, 0, requirement);
				}
				else{
					throw new Error('you can declare a requirement only before or during loading');
				}
			}

			return requirement;
		},

		loadRequirements: function(){
			this.state = 'loading';

			var self = this, requirements = this.requirements, requirement;

			self.requirementLoadIndex = 0;

			function nextRequirement(){
				if( self.requirementLoadIndex >= self.requirements.length ){
					//debug('ALL-REQUIREMENTS-COMPLETED');
					self.state = 'loaded';
					self.onload();
				}
				else{
					requirement = self.requirements[self.requirementLoadIndex];
					self.requirementLoadIndex++;
					requirement.load(nextRequirement);
				}
			}

			nextRequirement();
		},

		setup: function(){
			this.platform = this.findPlatform();
			if( this.platform == null ){
				throw new Error('your javascript environment in not supported');
			}
			this.platform.global = this.platform.getGlobal();
			this.platform.filename = this.platform.getSrc();
			this.platform.baseURL = this.platform.getBaseURL();
			this.platform.dirname = this.platform.filename.slice(0, this.platform.filename.lastIndexOf('/'));

			this.platform.name = this.platform.getName();
			this.platform.version = this.platform.getVersion();
			debug('platform type :', this.platform.type, '(', this.platform.name, this.platform.version, ')');
			debug('baseURI', this.platform.baseURL);

			this.baseURI = this.platform.baseURL;
			this.global = this.platform.global;
			this.global[this.globalName] = this;
			this.global.forOf = this.forOf = forOf;
			this.global.debug = debug;

			this.setupRequirements();
		},

		listEnvRequirements: function(){
			var polyfills = [
				'URLSearchParams',
				'URL',
				'setImmediate', // because required by promise
				'Symbol', // because required by iterator
				'Iterator', // because required by promise.all
				'Promise' // because it's amazing
				//'System'
			].filter(function(requirementName){
				return false === requirementName in this.global;
			}, this);

			return polyfills;
		},

		listPlatformRequirements: function(){
			return this.platform.getRequirements();
		},

		listRequirements: function(){
			var requirements = [];

			requirements = requirements.concat(this.listEnvRequirements());
			requirements.push(
				'module',
				'es6-loader',
				'store',
				'loader',
				'config',

				'duplex-stream',
				'http-headers',
				'http-body',
				'http-response',
				'http-request',
				'http-request-promise',
				'http-request-platform',
				'http-client',
				'http-event-stream',
				'http-event-source',
				'http'
			);
			//requirements = requirements.concat(this.listRequiredLoaders());
			requirements = requirements.concat(this.listPlatformRequirements());

			return requirements;
		},

		setupRequirements: function(){
			this.listRequirements().forEach(this.need, this);
			// ensure a minimal delay before loading requirements (give a chance for inline requirements to be defined)
			setTimeout(this.loadRequirements.bind(this), 0);
		},

		ready: function(fn){
			this.readyListeners.push(fn);
		},

		onload: function(){
			var self = this;

			this.readyListeners.reverse().reduce(function(previous, current){
				return previous.then(current.bind(self));
			}, Promise.resolve()).then(function(){
				self.platform.init();
			});
		},

		// called when jsenv is ready
		init: function(){
			if( this.mainModule ){
				debug('main module', this.mainModule);

				this.include(this.mainModule).then(function(main){
					this.main = main;
				}.bind(this));
			}
		}
	};

	var browserPlatform = {
		is: function(){
			return typeof window !== 'undefined';
		},

		getGlobal: function(){
			return window;
		},

		getSrc: function(){
			return document.scripts[document.scripts.length - 1].src;
		},

		getBaseURL: function(){
			var href = window.location.href.split('#')[0].split('?')[0];
			var baseUrl = href.slice(0, href.lastIndexOf('/') + 1);

			return baseUrl;
		},

		// browser must include script tag with the requirement
		load: function(url, done){
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

		getAgent: function(){
			var ua = navigator.userAgent.toLowerCase();
			var regex = /(opera|ie|firefox|chrome|version)[\s\/:]([\w\d\.]+)?.*?(safari|version[\s\/:]([\w\d\.]+)|$)/;
			var UA = ua.match(regex) || [null, 'unknown', 0];
			var name = UA[1] == 'version' ? UA[3] : UA[1];
			var version;

			// version
			if( UA[1] == 'ie' && document.documentMode ) version = document.documentMode;
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

		init: function(){
			function ready(){
				var scripts = document.getElementsByTagName('script'), i = 0, j = scripts.length, script;
				for(;i<j;i++){
					script = scripts[i];
					if( script.type === 'module' ){
						jsenv.loader.module(script.innerHTML.slice(1)).catch(function(error){
							setImmediate(function(){ throw error; });
						});
					}
				}

				jsenv.init();
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
		},

		restart: function(){
			window.location.reload(true);
		}
	};

	var processPlatform = {
		is: function(){
			return typeof process !== 'undefined';
		},

		getGlobal: function(){
			return global;
		},

		getSrc: function(){
			var src = 'file://' + __filename;

			if( process.platform.match(/^win/) ){
				src = src.replace(/\\/g, '/');
			}

			return src;
		},

		getBaseURL: function(){
			var baseUrl = 'file://' + process.cwd() + '/';

			if( process.platform.match(/^win/) ){
				baseUrl = baseUrl.replace(/\\/g, '/');
			}

			return baseUrl;
		},

		// in node env requires it
		load: function(url, done){
			var error = null;

			if( url.indexOf('file://') === 0 ){
				url = url.slice('file://'.length);
			}

			try{
				require(url);
			}
			catch(e){
				error = e;
			}

			done(error);
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
			var platform = process.platform;
			if( platform === 'win32' ) platform = 'windows';
			return platform;
		},

		init: function(){
			if( require.main === module ){
				throw new Error('jsenv must be required');
			}

			jsenv.init();
		},

		restart: function(){
			process.exit(2);
		}
	};

	jsenv.platforms.push(jsenv.createPlatform('browser', browserPlatform));
	jsenv.platforms.push(jsenv.createPlatform('process', processPlatform));

	jsenv.setup();
})();