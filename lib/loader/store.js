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

		createStorage: function(name, options){
			return new Storage(this, name, options);
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

		getUrlSelectorScore: function(urlSelector){
			var score = 0;

			if( urlSelector.protocol ){
				score+= 1;
			}
			if( urlSelector.host ){
				score+= 2;
			}
			if( urlSelector.port ){
				score+= 4;
			}
			if( urlSelector.pathname ){
				score+= 8;
			}
			if( urlSelector.dirname ){
				score+= 16;
			}
			if( urlSelector.extname ){
				score+= 32;
			}

			return score;
		},

		matchUrlSelector: function(urlSelector, url){
			if( urlSelector.protocol ){
				if( urlSelector.protocol != url.protocol.slice(0, -1) ){
					return false;
				}
			}
			if( urlSelector.host ){
				if( urlSelector.host != url.host ){
					return false;
				}
			}

			return true;
		},

		get: function(location){
			location = new URL(location);

			var i = this.storages.length, storage;

			while(i--){
				storage = this.storages[i];

				if( this.matchUrlSelector(storage.url, location) ){
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
			return store.getUrlSelectorScore(b.url) - store.getUrlSelectorScore(a.url);
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