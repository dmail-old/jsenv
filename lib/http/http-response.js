(function(){

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
			return new HttpResponse({
				status: this.status,
				headers: this.headers.toJSON(),
				body: this.body ? this.body.tee()[1] : null
			});
		}
	}));

	jsenv.define('http-response', HttpResponse);

})();
