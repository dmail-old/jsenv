/* global debug */

(function(){

	// storages
	var Storage = Function.create({
		constructor: function(env, name, options){
			this.env = env;
			this.name = name;
			Object.assign(this, options);
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
			return this.createStorage('http', {
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
			});
		},

		createHttpsStorage: function(){
			return this.createStorage('https', {
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
			});
		},

		setupStorages: function(){
			this.httpRequestFactory = this.getHttpRequestFactory();
			this.storages = this.getStorages();

			// httpRequestFactory is equivalent to auto create the http, https & github storages
			if( this.httpRequestFactory ){
				this.storages.push(
					this.createHttpStorage(),
					this.createHttpsStorage(),
					this.createGithubStorage()
				);
			}

			debug('readable storages :', this.storages.reduce(function(previous, storage){
				if( storage.get ) previous.push(storage.name);
				return previous;
			}, []));
			debug('writable storages :', this.storages.reduce(function(previous, storage){
				if( storage.set ) previous.push(storage.name);
				return previous;
			}, []));
		},

		/*
		createStorage: function(name, options){
			return new Storage(this, name, options);
		},
		*/

		findStorage: function(name){
			var i = this.storages.length, storage;
			while(i--){
				storage = this.storages[i];
				if( storage.name === name ) break;
				else storage = null;
			}
			return storage;
		}
	});
})();