(function(){

	// https://developer.mozilla.org/en-US/docs/Web/API/Response
	var DuplexStream = jsenv.require('duplex-stream');
	var Headers = jsenv.require('http-headers');
	var Body = jsenv.require('http-body');

	var HttpResponse = Function.create(Object.assign(Body, {
		status: 0,
		headers: {},
		body: null,

		cacheState: 'none', // 'local', 'validated', 'partial'

		constructor: function(options){
			options = options || {};

			Object.assign(this, options);

			this.headers = new Headers(this.headers);
		},

		clone: function(){
			var cloneResponse = new HttpResponse({
				status: this.status,
				headers: this.headers.toJSON(),
			});

			if( this.body ){
				var out = this.body.tee();
				this.body = out[0];
				cloneResponse.body = out[1];
			}

			return cloneResponse;
		}
	}));

	jsenv.define('http-response', HttpResponse);

})();
