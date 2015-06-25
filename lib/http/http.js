(function(){

	var HttpRequest = jsenv.require('http-request');
	var HttpResponse = jsenv.require('http-response');
	var HttpClient = jsenv.require('http-client');
	var PromiseRequest = jsenv.require('http-request-promise');
	var PlatformRequest = jsenv.require('http-request-platform');
	var HttpEventSource = jsenv.require('http-event-source');

	var http = {
		Request: HttpRequest,
		Response: HttpResponse,
		Client: HttpClient,

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
			return new Function.extend(this.PromiseRequest, {
				createPromise: promiseFactory
			})(options);
		},

		createResponsePromiseFromClient: function(client){
			return new Promise(function(resolve, reject){
				client.on('open', function(){
					resolve(client.response);
				});
			});
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
				return this.createResponsePromiseFromRequest(this.createPromiseRequest(item, arguments[1]));
			}
			else{
				return this.createResponsePromiseFromRequest(this.createRequest(item));
			}
		},

		createEventSource: function(url, options){
			return new HttpEventSource(url, options);
		},

		setup: function(){
			this.Request = Function.extend(HttpRequest, PlatformRequest);
			this.PromiseRequest = Function.extend(HttpRequest, PromiseRequest);
		}
	};

	jsenv.http = http;
	jsenv.define('http', http);

})();