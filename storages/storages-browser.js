jsenv.define('platform-storages', {
	file: {
		createGetPromise: function(options){
			return this.findStorage('http').createGetPromise(options).then(function(response){
				// fix for browsers returning status == 0 for local file request
				if( response.status === 0 ){
					response.status = response.body ? 200 : 404;
				}
			});
		}
	}
});