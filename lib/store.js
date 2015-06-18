/* global debug */

(function(){

	var HttpResponse = Function.create({
		status: 0,
		headers: {},

		constructor: function(){
			this.buffers = [];
			this.length = 0;
		},

		onerror: function(error){

		},

		ontimeout: function(){

		},

		onopen: function(){

		},

		onwrite: function(data){

		},

		onclose: function(){

		},

		open: function(status, headers){
			this.status = status;
			this.headers = headers;
			this.onopen();
		},

		write: function(data){
			this.buffers.push(data);
			this.length+= data.length;
			this.onwrite(data);
		},

		close: function(){
			this.onclose();
		}
	});

	var HttpResponsePromise = Function.create({
		retryTimeout: 100,
		redirectLimit: 10,

		lastRetry: 0,
		redirectCount: 0,
		aborted: false,
		retryUrl: null,

		pipes: [
			function saveResponse(response){
				if( typeof response === 'number' ) response = {status: response};
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
				if( status == 301 || status == 302 || status == 307 ){
					if( this.hasResponseHeader('location') ){
						return this.redirect(this.getResponseHeader('location'));
					}
					else{
						throw new Error('location header missing');
					}
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

		constructor: function(options, responseFactory){
			this.options = options;
			this.responseFactory = responseFactory;

			if( this.options.mtime ){
				this.setRequestHeader('if-modified-since', this.options.mtime.toUTCString());
			}

			this.promise = new Promise(function(resolve, reject){
				this.resolve = resolve;
				this.reject = reject;
			}.bind(this));

			this.send();
		},

		setRequestHeader: function(name, value){
			if( !this.options.headers ) this.options.headers = {};
			this.options.headers[name] = value;
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

		createResponsePromise: function(){
			var response = this.responseFactory(this.options);

			return new Promise(function(resolve, reject){
				response.onclose = function(){
					resolve(response);
					/*
					resolve({
						status: response.status,
						headers: response.headers,
						body: response.body
					});
					*/
				};

				response.onerror = function(error){
					reject(error);
				};

				response.ontimeout = function(){
					reject();
				};

				response.send();
			});
		},

		send: function(){
			var responsePromise = this.createResponsePromise();

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
						if( self.retryUrl ) self.options.url = self.retryUrl;
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

				// tmeporary redirect must do the request to the old url on retry
				if( this.getResponseStatus() === 307 ){
					this.retryUrl = this.options.url;
				}
				else{
					this.retryUrl = url;
				}

				this.options.url = url;

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

		createRequest: function(options, properties){
			return Object.complete({}, options, properties);
		},

		createGetRequest: function(request){
			return Object.complete(request, {
				method: 'GET'
			});
		},

		createSetRequest: function(request){
			return Object.complete(request, {
				method: 'POST'
			});
		},

		resolveRequest: function(request, responseFactory){
			var response = new HttpResponsePromise(request, responseFactory.bind(this));
			return response;
		},

		read: function(url, options){
			if( !this.isReadable() ){
				throw new Error('unsupported read at ' + url);
			}

			var request = this.createRequest(options, {url: url});
			request = this.createGetRequest(request);

			return this.resolveRequest(request, this.createGetPromise.bind(this));
		},

		write: function(url, body, options){
			if( !this.isWritable() ){
				throw new Error('unsupported write at ' + url);
			}

			var request = this.createRequest(options, {url: url, body: body});
			request = this.createSetRequest(request);

			return this.resolveRequest(request, this.createSetPromise.bind(this));
		}
	});

	var store = {
		env: jsenv,

		createHttpResponse: function(){
			return new HttpResponse();
		},

		createHttpStorage: function(){
			return {
				createGetPromise: function(request){
					return this.store.createResponse(request);
				},

				createSetPromise: function(request){
					return this.store.createResponse(request);
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