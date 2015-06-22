/* global debug */

(function(){
	var Storage = Function.create({
		constructor: function(store, name, options){
			this.store = store;
			this.name = name;
			Object.assign(this, options);
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

		createHttpStorage: function(){
			return {
				createGetPromise: function(options){
					return this.store.env.http.createResponsePromise(options);
				},

				createSetPromise: function(options){
					return this.store.env.http.createResponsePromise(options);
				}
			};
		},

		createHttpsStorage: function(){
			return this.createHttpStorage();
		},

		createStorage: function(name, options){
			return new Storage(this, name, options);
		},

		setup: function(){
			this.createResponse = this.env.require('platform-http')();
			var storages = this.env.require('platform-storages');

			this.storages = Object.keys(storages).map(function(storageName){
				return this.createStorage(storageName, storages[storageName]);
			}, this);

			debug('readable storages :', this.storages.reduce(function(previous, storage){
				if( storage.isReadable() ) previous.push(storage.name);
				return previous;
			}, []));
			debug('writable storages :', this.storages.reduce(function(previous, storage){
				if( storage.isWritable() ) previous.push(storage.name);
				return previous;
			}, []));
		},

		find: function(name){
			var i = this.storages.length, storage;

			while(i--){
				storage = this.storages[i];
				if( storage.name === name ) break;
				else storage = null;
			}

			return storage;
		},

		createStorageNotFoundError: function(location){
			var error = new Error(location + ' has no associated storage');
			return error;
		},

		// ça ne marche pas puisqu'il faudrait que github soit testé avant http puisque plus précis
		isStorageFor: function(storage, location){
			var name = storage.name;

			if( name === 'github' ){
				return location.host === 'github.com';
			}
			if( name === 'http' || name === 'https' || name === 'file' ){
				return location.protocol.slice(0, 1) === name;
			}
			return false;
		},

		get: function(location){
			location = new URL(location);

			var i = this.storages.length, storage;

			while(i--){
				storage = this.storages[i];
				if( this.isStorageFor(storage, location) ){
					break;
				}
				else{
					storage = null;
				}
			}

			if( !storage ){
				throw this.createStorageNotFoundError(location);
			}

			return storage;
		}
	};

	jsenv.store = store;
	jsenv.loader.read = function(location, options){
		return this.env.store.get(location).read(location, options);
	};
	jsenv.loader.write = function(location, body, options){
		return this.env.store.get(location).write(location, body, options);
	};

	jsenv.define('store');

})();