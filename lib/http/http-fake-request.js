(function(){
	var HttpFakeRequest = {
		createPromise: function(options){
			throw new Error('unimplemented createPromise()');
		},

		populateResponseFromPromise: function(promise){
			var connection = this.connection, request = this;

			return promise.then(function(response){
				if( connection.aborted ) return;

				if( typeof response === 'number' ) response = {status: response};

				request.opened(response.status, response.headers, response.body);
			}).catch(function(e){
				request.onerror(e);
			});
		},

		connect: function(){
			this.populateResponseFromPromise(this.createPromise(this.options));

			// crée une connexion qui ne peut écrire dans réponse qui si non-aborted
			return {
				aborted: false
			};
		},

		abort: function(){
			this.connection.aborted = true;
			this.clearSource();
		}
	};

	jsenv.define('http-fake-request', HttpFakeRequest);

})();