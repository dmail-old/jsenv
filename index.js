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
		if( arg && typeof arg == 'object' && 'name' in arg ){
			arg = arg.name ? String(arg.name) : 'anonymous module';
		}
		return arg;
	});

	console.log.apply(console, args);
}

Function.create = function(proto){
	proto.constructor.prototype = proto;
	return proto.constructor;
};

Function.extend = function(constructor, proto){
	var object = Object.create(constructor.prototype);
	for(var key in proto ) object[key] = proto[key];
	object.constructor.prototype = object;
	return object.constructor;
};

function mapProperties(args, fn){
	var object = args[0], i = 1, j = arguments.length, owner, keys, n, m;

	for(;i<j;i++){
		owner = arguments[i];
		if( Object(owner) != owner ) continue;
		keys = Object.keys(owner);
		n = 0;
		m = keys.length;

		for(;n<m;n++){
			fn(object, keys[n], owner);
		}
	}
}

if( !Object.assign ){
	Object.assign = function(){
		mapProperties(arguments, function(object, key, owner){
			object[key] = owner[key];
		});
	};
}

Object.complete = function(){
	mapProperties(arguments, function(object, key, owner){
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

(function(){
	// platforms
	var Platform = Function.create({
		retryTimeout: 100, // retry 503 request for this duration

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
				'more',
				'http',
				'storages'
			];
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
			if( typeof options === 'string' ){
				options = {location: options};
			}

			Object.assign(this, options);
			if( callback ) this.onload = callback;
		},

		onload: function(){

		},

		onResolve: function(){
			this.loaded = true;
			this.onload(this.value);
		},

		onReject: function(error){
			throw new Error('An error occured during requirement loading at ' + this.location + '\n' + error);
		}
	});

	var jsenv = {
		state: 'created',
	};

	Object.assign(jsenv, {
		// platforms
		platforms: [],
		platform: null,
		globalName: 'jsenv',
		global: null,
		baseURI: null,
		baseURL: './', // relative to baseURI

		aliases: {
			// dependencies
			'URI': '/requirements/URI.js',
			'setImmediate': '/requirements/setImmediate.js',
			'Symbol': '/requirements/Symbol.js',
			'Iterator': '/requirements/Iterator.js',
			'Promise': '/requirements/Promise.js',

			// lib
			'module': '/lib/module.js',
			'es6-loader': '/lib/es6-loader.js',
			'loader': '/lib/loader.js',
			'config': '/lib/config.js',

			// loaders
			'loader-js': '/loaders/loader-js.js',
			'loader-css': '/loaders/loader-css.js',

			// platform
			'http': '/platforms/{platform}/{platform}-http.js',
			'storages': '/platforms/{platform}/{platform}-storages.js',
			'more': '/platforms/{platform}/{platform}-more.js',

			'env-storages': '/lib/storages.js',
			'env-global': '/lib/global.env.js',
			// project
			'env-project': './project.env.js'
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
			while(i-- && this.requirements[i].path !== requirementLocation);
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
			}
		},

		require: function(requirementName){
			var requirementLocation = this.locate(requirementName);
			var requirement = this.get(requirementLocation);

			if( requirement ){
				return requirement.value;
			}
			else{
				throw new Error('requirement' + requirementName + 'not found');
			}
		},

		need: function(requirementName, onload){
			var requirementLocation = this.locate(requirementName);
			var requirement = this.get(requirementLocation);

			if( requirement ){
				requirement.onload = onload;
			}
			else{
				requirement = this.createRequirement(requirementLocation, onload);

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

			var self = this, requirements = this.requirements, requirement, location;

			self.requirementLoadIndex = 0;

			function loadRequirement(){
				if( requirement.loaded ){
					requirement.onload(requirement.value);
					nextRequirement();
				}
				else{
					location = requirement.location;
					location = location.replace(/{platform}/g, self.platform.type);

					// / means relative to the jsenv dirname here, not the env root
					if( location[0] === '/' ){
						location = self.platform.dirname + location;
					}
					else if( location.slice(0, 2) === './' ){
						location = self.baseURI + location.slice(2);
					}

					debug('REQUIRE', location);
					self.platform.load(location, onRequirementLoad);
				}
			}

			function onRequirementLoad(error){
				if( error ){
					requirement.onReject(error);
				}
				else{
					requirement.onResolve();
					//debug('REQUIRED', requirement.path);
					nextRequirement();
				}
			}

			function nextRequirement(){
				if( self.requirementLoadIndex >= self.requirements.length ){
					//debug('ALL-REQUIREMENTS-COMPLETED');
					self.state = 'loaded';
					self.onload();
				}
				else{
					requirement = self.requirements[self.requirementLoadIndex];
					self.requirementLoadIndex++;
					loadRequirement();
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

			this.baseURI = this.platform.baseURL;
			this.global = this.platform.global;
			this.global[this.globalName] = this;
			this.global.forOf = this.forOf = forOf;
			this.global.debug = debug;

			this.setupRequirements();
		},

		listEnvRequirements: function(){
			var polyfills = [
				'setImmediate', // because required by promise
				'Symbol', // because required by iterator
				'Iterator', // because required by promise.all
				'Promise' // because it's amazing
				//'System'
			].filter(function(requirementName){
				return false === requirementName in this.global;
			}, this);

			polyfills.unshift('URI');

			return polyfills;
		},

		listPlatformRequirements: function(){
			return this.platform.getRequirements();
		},

		listRequiredLoaders: function(){
			return this.useLoaders.map(function(loaderName){
				return '/loaders/loader-' + loaderName + '.js';
			});
		},

		listRequirements: function(){
			var requirements = [];

			requirements = requirements.concat(this.listEnvRequirements());
			requirements.push(
				'module',
				'es6-loader',
				'loader',
				'config'
			);
			requirements = requirements.concat(this.listRequiredLoaders());
			requirements = requirements.concat(this.listPlatformRequirements());
			requirements.push(
				'env-storages',
				'env-global',
				'env-project'
			);

			return requirements;
		},

		setupRequirements: function(){
			this.listRequirements().forEach(this.need, this);
			// ensure a minimal delay before loading requirements (give a chance for inline requirements to be defined)
			setTimeout(this.loadRequirements.bind(this), 0);
		},

		mode: undefined, // 'install', 'update', 'run'
		onload: function(){ // called when requirements are loaded
			this.platform.name = this.platform.getName();
			this.platform.version = this.platform.getVersion();
			debug('platform type :', this.platform.type, '(', this.platform.name, this.platform.version, ')');

			this.loaders = {};
			this.useLoaders.forEach(function(loaderName){
				this.loaders[loaderName] = this.createLoader(this.require(loaderName));
			}, this);

			this.platform.setupStorages();
			this.platform.init();
		},

		// called when jsenv is ready
		init: function(){
			if( this.mainModule ){
				var main = this.main = this.loader.createModule(
					/*this.loader.normalize(*/this.mainModule//)
				);

				if( !this.mode ){
					throw new Error('jsenv mode not set');
				}

				debug(this.mode, 'main module', this.mainModule);

				main.then(function(){
					main.parse();
					main.execute();
				}).catch(function(error){
					setImmediate(function(){
						throw error;
					});
				});
			}
		}
	});

	var browserPlatform = jsenv.createPlatform('browser', {
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
		}
	});
	jsenv.platforms.push(browserPlatform);

	var processPlatform = jsenv.createPlatform('process', {
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
		}
	});
	jsenv.platforms.push(processPlatform);

	jsenv.setup();
})();