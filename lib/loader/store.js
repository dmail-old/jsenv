/* global debug */

(function(){

	var URLSelector = Function.create({
		constructor: function(parts){
			Object.assign(this, parts);
		},

		match: function(url){
			if( this.protocol ){
				if( this.protocol != url.protocol.slice(0, -1) ){
					return false;
				}
			}
			if( this.hostname ){
				if( this.hostname != url.hostname ){
					return false;
				}
			}

			return true;
		},

		valueOf: function(){
			var score = 0;

			if( this.protocol ){
				score+= 1;
			}
			if( this.hostname ){
				score+= 2;
			}
			if( this.port ){
				score+= 4;
			}
			if( this.pathname ){
				score+= 8;
			}
			if( this.dirname ){
				score+= 16;
			}
			if( this.extname ){
				score+= 32;
			}

			return score;
		}
	});

	var Storage = Function.create({
		constructor: function(store, name, options){
			this.store = store;
			this.name = name;
			Object.assign(this, options);
			this.urlSelector = new URLSelector(options.url);
		},

		isReadable: function(){
			return Boolean(this.createGetPromise);
		},

		isWritable: function(){
			return Boolean(this.createSetPromise);
		},

		createRequestoptions: function(options, properties){
			return Object.complete({}, options, properties);
		},

		read: function(url, options){
			if( !this.isReadable() ){
				throw new Error('unsupported read at ' + url);
			}

			options = this.createRequestoptions(options, {method: 'GET', url: url});

			return this.createGetPromise(options);
		},

		write: function(url, body, options){
			if( !this.isWritable() ){
				throw new Error('unsupported write at ' + url);
			}

			options = this.createRequestoptions(options, {method: 'POST', url: url, body: body});

			return this.createSetPromise(options);
		}
	});

	var store = {
		env: jsenv,

		createStorage: function(name, options){
			return new Storage(this, name, options);
		},

		find: function(fn, bind){
			var storages = this.storages, i = 0, j = storages.length, storage;

			for(;i<j;i++){
				storage = storages[i];

				if( fn.call(bind, storage, i, storages) ){
					break;
				}
				else{
					storage =null;
				}
			}

			return storage;
		},

		findByName: function(name){
			return this.find(function(storage){
				return storage.name === name;
			});
		},

		findByURL: function(location){
			location = new URL(location);

			var storage = this.find(function(storage){
				return storage.urlSelector.match(location);
			});

			if( !storage ){
				throw this.createStorageNotFoundError(location);
			}

			return storage;
		},

		createStorageNotFoundError: function(location){
			var error = new Error(location + ' has no associated storage');
			return error;
		},

		read: function(location, options){
			return this.findByURL(location).read(location, options);
		},

		write: function(location, body, options){
			return this.findByURL(location).write(location, body, options);
		}
	};

	function createHttpStorages(){
		return {
			http: {
				url: {
					protocol: 'http'
				},

				createGetPromise: function(options){
					return this.store.env.http.createResponsePromise(options);
				},

				createSetPromise: function(options){
					return this.store.env.http.createResponsePromise(options);
				}
			},

			https: {
				url: {
					protocol: 'https'
				},

				createGetPromise: function(options){
					return this.store.env.http.createResponsePromise(options);
				},

				createSetPromise: function(options){
					return this.store.env.http.createResponsePromise(options);
				}
			}
		};
	}

	jsenv.ready(function setupStore(){
		var storages = this.require('platform-storages');

		Object.assign(storages, createHttpStorages());

		store.storages = Object.keys(storages).map(function(storageName){
			return store.createStorage(storageName, storages[storageName]);
		}).sort(function(a, b){
			return b.urlSelector - a.urlSelector;
		});

		debug('readable storages :', store.storages.reduce(function(previous, storage){
			if( storage.isReadable() ) previous.push(storage.name);
			return previous;
		}, []));
		debug('writable storages :', store.storages.reduce(function(previous, storage){
			if( storage.isWritable() ) previous.push(storage.name);
			return previous;
		}, []));
	});

	jsenv.define('store', store);

})();