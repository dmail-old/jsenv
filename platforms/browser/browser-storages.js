jsenv.platform.register('storages.js', {
	file: {
		get: function(request){
			request.then = function(response){
				// fix for browsers returning status == 0 for local file request
				if( response.status === 0 ){
					response.status = response.body ? 200 : 404;
				}
				return response;
			};
			return request;
		}
	}
});