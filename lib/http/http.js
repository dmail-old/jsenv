(function(){

	var HttpRequest = jsenv.require('http-request');
	var HttpPromiseRequest = jsenv.require('http-request-promise');
	var HttpPlatformRequest = jsenv.require('http-request-platform');

	var HttpResponse = jsenv.require('http-response');
	var HttpClient = jsenv.require('http-client');
	var HttpEventSource = jsenv.require('http-event-source');

	HttpPlatformRequest = Function.extend(HttpRequest, HttpPlatformRequest);

	var http = {
		Request: HttpPlatformRequest,
		PromiseRequest: HttpPromiseRequest,
		Response: HttpResponse,
		Client: HttpClient,
		cache: HttpClient.prototype.cache,

		createRequest: function(options){
			return new this.Request(options);
		},

		createResponse: function(){
			return new this.Response();
		},

		createClient: function(request){
			return new this.Client(request);
		},

		createPromiseRequest: function(promiseFactory, options){
			var CustomPromiseRequest = Function.extend(this.PromiseRequest, {
				createPromise: promiseFactory
			});

			var request = new CustomPromiseRequest(options);

			return request;
		},

		createResponsePromiseFromClient: function(client){
			client.open();
			return Promise.resolve(client);
		},

		createResponsePromiseFromRequest: function(request){
			var client = this.createClient(request);
			return this.createResponsePromiseFromClient(client);
		},

		createResponsePromise: function(item){
			if( item instanceof HttpClient ){
				return this.createResponsePromiseFromClient(item);
			}
			else if( item instanceof HttpRequest ){
				return this.createResponsePromiseFromRequest(item);
			}
			else if( typeof item === 'function' ){
				return this.createResponsePromise(this.createPromiseRequest(item, arguments[1]));
			}
			else{
				return this.createResponsePromise(this.createRequest(item));
			}
		},

		createEventSource: function(url, options){
			return new HttpEventSource(url, options);
		}
	};

	jsenv.http = http;
	jsenv.define('http', http);

})();