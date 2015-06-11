jsenv.define('platform-storages', {
	http: jsenv.createHttpStorage(),
	https: jsenv.createHttpsStorage(),
	file: {
		createGetPromise: function(request){
			return this.store.createHttpRequest(request).then(function(response){
				// fix for browsers returning status == 0 for local file request
				if( response.status === 0 ){
					response.status = response.body ? 200 : 404;
				}
				return response;
			});
		}
	}
});