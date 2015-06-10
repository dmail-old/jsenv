/* global debug */

(function(){

	var Storage = Function.create({
		constructor: function(store, name, options){
			this.store = store;
			this.name = name;
			Object.assign(this, options);
		},

		isReadable: function(){
			return Boolean(this.get);
		},

		isWritable: function(){
			return Boolean(this.set);
		},

		createRequest: function(options, properties){
			return Object.assign({}, options, properties);
		},

		createResponsePromise: function(request, requestType){
			return this[requestType](request);
		},

		resolveRequest: function(request, requestType){
			var responsePromise = this.createResponsePromise(request, requestType);

			if( request.mtime ){
				request.headers = request.headers || {};
				request.headers['if-modified-since'] = request.mtime;
			}

			return responsePromise.then(function(response){
				if( response.headers && 'last-modified' in response.headers ){
					response.mtime = new Date(response.headers['last-modified']);
				}
				return response;
			// 503
			}).then(function(response){
				if( response.status === 503 && response.headers && 'retry-after' in response.headers ){
					var lastRetry = request['last-retry'] || 0;
					var retryAfter = response.headers['retry-after'];
					var retryDuration = lastRetry + retryAfter;
					var self = this;

					if( retryDuration <= this.retryTimeout ){
						request['last-retry'] = retryDuration;

						return new Promise(function(resolve, reject){
							setTimeout(function(){
								resolve(self.createResponsePromise(request, requestType));
							}, retryAfter);
						});
					}
				}
				return response;
			}.bind(this));
		},

		read: function(url, options){
			if( !this.isReadable() ){
				throw new Error('unsupported read at ' + url);
			}
			var request = this.createRequest(options, {url: url});

			return this.resolveRequest(request, 'get');
		},

		write: function(url, body, options){
			if( !this.isWritable() ){
				throw new Error('unsupported write at ' + url);
			}
			var request = this.createRequest(options, {url: url, body: body});

			return this.resolveRequest(request, 'set');
		}
	});

	var store = {
		env: jsenv,

		createHttpStorage: function(){
			return {
				get: function(request){
					Object.complete(request, {
						method: 'GET'
					});
					return this.store.createHttpRequest(request.url, request);
				},

				set: function(request){
					Object.complete(request, {
						method: 'POST'
					});
					return this.store.createHttpRequest(request.url, request);
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
			this.createHttpRequest = this.env.require('platform-http');
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

		get: function(location){
			location = new URI(location);
			var name = location.protocol.slice(0, -1); // remove ':' from 'file:'
			var storage = this.find(name);

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