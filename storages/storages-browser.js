jsenv.define('platform-storages', {
	http: jsenv.createHttpStorage(),
	https: jsenv.createHttpsStorage(),
	file: {
		createGetPromise: function(request){
			var response = this.createResponse(request);

			// fix for browsers returning status == 0 for local file request
			response.close = function(){
				if( this.status === 0 ){
					this.status = this.body ? 200 : 404;
				}
				this.onclose();
			};

			return response;
		}
	}
});