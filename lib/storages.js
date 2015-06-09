/* global debug */

(function(){

	// storages
	var Storage = Function.create({
		constructor: function(env, name, options){
			this.env = env;
			this.name = name;
			Object.assign(this, options);
		},

		isReadable: function(){
			return Boolean(this.get);
		},

		isWritable: function(){
			return Boolean(this.set);
		},

		read: function(url, options){
			if( !this.isReadable() ){
				throw new Error('unsupported read at ' + url);
			}

			options = options || {};
			options.url = url;

			return this.env.createModuleHttpRequest(this.get(options));
		},

		write: function(url, body, options){
			if( !this.isWritable() ){
				throw new Error('unsupported write at ' + url);
			}

			options = options || {};
			options.url = url;
			options.body = body;

			return this.env.createModuleHttpRequest(this.set(options));
		}
	});

	Object.assign(jsenv, {
		createModuleHttpRequest: function(request){
				if( request.mtime ){
					request.headers = request.headers || {};
					request.headers['if-modified-since'] = request.mtime;
				}

				return this.httpRequestFactory(request.url, request)
				// mtime
				.then(function(response){
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
									resolve(self.createModuleHttpRequest(request));
								}, retryAfter);
							});
						}
					}
					return response;
				}.bind(this));
		},

		createHttpStorage: function(){
			return {
				get: function(request){
					return Object.complete(request, {
						method: 'GET'
					});
				},

				set: function(request){
					return Object.complete(request, {
						method: 'POST'
					});
				}
			};
		},

		createHttpsStorage: function(){
			return {
				get: function(request){
					return Object.complete(request, {
						method: 'GET'
					});
				},

				set: function(request){
					return Object.complete(request, {
						method: 'POST'
					});
				}
			};
		},

		createStorage: function(name, options){
			return new Storage(this, name, options);
		},

		setupStorages: function(){
			this.httpRequestFactory = this.get('http');

			var storages = this.get('storages');

			// when 'http' exists we can auto create the http & https storages
			if( this.httpRequestFactory ){
				Object.complete(storages, {
					http: this.createHttpStorage(),
					https: this.createHttpsStorage(),
					github: this.createGithubStorage()
				});
			}

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

		findStorage: function(name){
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
		},

		getStorage: function(location){
			location = new URI(location);
			var name = location.protocol.slice(0, -1); // remove ':' from 'file:'
			var storage = this.findStorage(name);

			if( !storage ){
				throw this.createStorageNotFoundError(location);
			}

			return storage;
		},

		read: function(location, options){
			return this.getStorage(location).read(location, options);
		},

		write: function(location, body, options){
			return this.getStorage(location).write(location, body, options);
		}
	});
})();