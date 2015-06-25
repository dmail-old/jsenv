(function(){

	var ES6Loader = Function.create({
		Module: jsenv.require('module'),
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
			if( false === module instanceof this.Module ){
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
			return new this.Module(this, normalizedName);
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

	jsenv.define('es6-loader', ES6Loader);

})();