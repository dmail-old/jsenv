(function(){
	var HttpRequest = jsenv.require('http-request');

	var HttpPromiseRequest = {
		createPromise: function(){
			throw new Error('unimplemented createPromise()');
		},

		populateResponseFromPromise: function(promise){
			var connection = this.connection, request = this;

			return promise.then(function(response){

			}).catch(function(e){

			});
		},

		connect: function(){
			var connection, request;

			// crée une connexion qui ne peut écrire dans réponse qui si non-aborted
			connection = {
				aborted: false
			};
			request = this;

			this.createPromise().then(function(response){
				if( connection.aborted ) return;

				if( typeof response === 'number' ) response = {status: response};

				request.opened(response.status, response.headers, response.body);
			}).catch(function(e){
				request.onerror(e);
			});

			return connection;
		},

		abort: function(){
			this.connection.aborted = true;
			this.clearSource();
		}
	};
	HttpPromiseRequest = Function.extend(HttpRequest, HttpPromiseRequest);

	jsenv.define('http-request-promise', HttpPromiseRequest);

})();