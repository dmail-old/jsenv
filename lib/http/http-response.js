(function(){

	// https://developer.mozilla.org/en-US/docs/Web/API/Response
	var DuplexStream = jsenv.require('duplex-stream');
	var HttpHeaders = jsenv.require('http-headers');
	var HttpBody = jsenv.require('http-body');

	var HttpResponse = Function.create(Object.assign({}, HttpBody, {
		status: 0,
		headers: {},
		body: null,

		cacheState: 'none', // 'local', 'validated', 'partial'

		constructor: function(options){
			options = options || {};

			Object.assign(this, options);

			this.headers = new HttpHeaders(this.headers);
		},

		clone: function(){
			var cloneResponse = new this.constructor({
				status: this.status,
				headers: this.headers.toJSON(),
				cacheState: this.cacheState
			});

			if( this.body ){
				var out = this.body.tee();
				this.body = out[0];
				cloneResponse.body = out[1];
			}

			return cloneResponse;
		}
	}));

	HttpResponse.prototype[Symbol.species] = HttpResponse;

	jsenv.define('http-response', HttpResponse);

})();
