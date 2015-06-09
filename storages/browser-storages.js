jsenv.define('storages', {
	file: {
		read: function(url, options){
			return this.env.findStorage('http').read(url, options).then(function(response){
				// fix for browsers returning status == 0 for local file request
				if( response.status === 0 ){
					response.status = response.body ? 200 : 404;
				}
				return response;
			});
		}
	}
});