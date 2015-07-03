(function(){
	var HttpRequest = jsenv.require('http-request');

	var HttpPromiseRequest = {
		createPromise: function(request){
			throw new Error('unimplemented createPromise()');
		},

		connect: function(){
			var connection, request;

			// crée une connexion qui ne peut écrire dans réponse qui si non-aborted
			connection = {
				aborted: false
			};
			request = this;

			this.createPromise(request).then(function(responseProperties){
				if( connection.aborted ) return;

				if( typeof responseProperties === 'number' ) responseProperties = {status: responseProperties};

				request.opened(responseProperties.status, responseProperties.headers, responseProperties.body);
			}).catch(function(e){
				request.onerror(e);
			});

			return connection;
		},

		abort: function(){
			this.connection.aborted = true;
		}
	};
	HttpPromiseRequest = Function.extend(HttpRequest, HttpPromiseRequest);

	jsenv.define('http-request-promise', HttpPromiseRequest);

})();