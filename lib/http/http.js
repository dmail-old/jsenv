(function(){

	var HttpRequest = jsenv.require('http-request');
	var HttpResponse = jsenv.require('http-response');
	var HttpClient = jsenv.require('http-client');
	var HttpFakeRequest = jsenv.require('http-fake-request');

	var http = {
		Request: HttpRequest,
		Response: HttpResponse,
		Client: HttpClient,

		createRequest: function(options){
			return new HttpRequest(options);
		},

		createResponse: function(){
			return new HttpResponse();
		},

		createClient: function(request){
			return new HttpClient(request);
		},

		createPromiseRequest: function(promiseFactory, options){
			return new Function.extend(this.FakeRequest, {
				createPromise: promiseFactory
			})(options);
		},

		createResponsePromiseFromClient: function(client){
			return new Promise(function(resolve, reject){
				if( client.request.readyState === 'closed' ){
					resolve(client.response);
				}
				else{
					client.onclose = function(){
						resolve(client.response);
					};
				}
			});
		},

		createResponsePromiseFromRequest: function(request){
			var client = this.env.http.createClient(request);
			return this.createResponsePromiseFromClient(client);
		},

		createResponsePromise: function(item){
			if( item instanceof HttpRequest ){
				return this.createResponsePromiseFromRequest(item);
			}
			else if( item instanceof HttpClient ){
				return this.createResponsePromiseFromClient(item);
			}
			else if( typeof item === 'function' ){
				return this.createResponsePromiseFromRequest(this.createPromiseRequest(item, arguments[1]));
			}
			else{
				return this.createResponsePromiseFromRequest(this.createRequest(item));
			}
		},

		setup: function(){
			this.FakeRequest = Function.extend(jsenv.require('platform-http'), HttpFakeRequest);
		}
	};

	jsenv.http = http;
	jsenv.define('http', http);

})();