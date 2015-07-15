(function(){
	var HttpRequest = jsenv.require('http-request');

	var HttpPromiseRequest = {
		createPromise: function(request){
			throw new Error('unimplemented createPromise()');
		},

		connect: function(){
			return {
				promise: this.createPromise(this),
				setTimeout: setTimeout,
				abort: function(){}
			};
		}
	};
	HttpPromiseRequest = Function.extend(HttpRequest, HttpPromiseRequest);

	jsenv.define('http-request-promise', HttpPromiseRequest);

})();