/* global debug */

(function(){

	var HttpResponsePromise = Function.create({
		retryTimeout: 100,
		redirectLimit: 10,

		lastRetry: 0,
		redirectCount: 0,
		aborted: false,

		pipes: [
			function saveResponse(response){
				this.response = response;
			},
			function mtime(){
				if( this.hasResponseHeader('last-modified') ){
					this.response.mtime = new Date(this.getResponseHeader('last-modified'));
				}
			},
			// https://developer.github.com/v3/#http-redirects
			function redirect(){
				var status = this.getResponseStatus();
				if( (status == 301 || status == 302 || status == 307) && this.hasResponseHeader('location') ){
					return this.redirect(this.getResponseHeader('location'));
				}
			},
			function retry(){
				var status = this.getResponseStatus();
				if( status == 503 && this.hasResponseHeader('retry-after') ){
					return this.retry(this.getResponseHeader('retry-after'));
				}
			},
			function resolve(){
				return this.resolve(this.response);
			}
		],

		constructor: function(request, responseFactory){
			this.request = request;
			this.responseFactory = responseFactory;

			if( this.request.mtime ){
				this.setRequestHeader('if-modified-since', this.request.mtime);
			}

			this.promise = new Promise(function(resolve, reject){
				this.resolve = resolve;
				this.reject = reject;
			}.bind(this));

			this.send();
		},

		setRequestHeader: function(name, value){
			if( !this.request.headers ) this.request.headers = {};
			this.request.headers[name] = value;
		},

		hasResponseHeader: function(name){
			return this.response.headers && name in this.response.headers;
		},

		getResponseHeader: function(name){
			return this.response.headers[name];
		},

		getResponseStatus: function(){
			return this.response.status;
		},

		createResponse: function(request){
			return this.responseFactory(request);
		},

		send: function(){
			var responsePromise = this.createResponse(this.request);

			this.pipes.forEach(function(pipe){
				responsePromise = responsePromise.then(pipe.bind(this));
			}, this);
		},

		retry: function(delay){
			var lastRetry = this.lastRetry;
			var retryDuration = lastRetry + delay;
			var self = this;

			if( retryDuration > this.retryTimeout ){
				// max retry duration reached
				return this.response;
			}
			else{
				this.lastRetry = retryDuration;

				return new Promise(function(resolve, reject){

					setTimeout(function(){
						resolve(self.send());
					}, delay);

				});
			}
		},

		redirect: function(url){
			if( this.redirectCount >= this.redirectLimit ){
				// max redirect limit reached
				return this.response;
			}
			else{
				this.redirectCount++;
				this.request.url = url;
				return this.send();
			}
		},

		abort: function(){
			this.aborted = true;
			this.resolve = this.reject = this.retry = this.redirect = this.send = function(){};
		},

		then: function(a, b){
			return this.promise.then(a, b);
		}
	});

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

		createGetRequest: function(options, properties){
			return Object.complete({}, options, properties);
		},

		createSetRequest: function(options, properties){
			return Object.complete({}, options, properties);
		},

		resolveRequest: function(request, requestFactory){
			var response = new HttpResponsePromise(request, requestFactory.bind(this));
			return response;
		},

		read: function(url, options){
			if( !this.isReadable() ){
				throw new Error('unsupported read at ' + url);
			}

			var request = this.createGetRequest(options, {url: url});
			return this.resolveRequest(request, this.createGetPromise.bind(this));
		},

		write: function(url, body, options){
			if( !this.isWritable() ){
				throw new Error('unsupported write at ' + url);
			}

			var request = this.createSetRequest(options, {url: url, body: body});
			return this.resolveRequest(request, this.createSetPromise.bind(this));
		}
	});

	var store = {
		env: jsenv,

		createHttpStorage: function(){
			return {
				createGetPromise: function(request){
					return this.store.createHttpRequest(request);
				},

				createSetPromise: function(request){
					return this.store.createHttpRequest(request);
				},

				createGetRequest: function(request){
					Object.complete(request, {
						method: 'GET'
					});
					return request;
				},

				createSetRequest: function(request){
					Object.complete(request, {
						method: 'POST'
					});
					return request;
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