(function(){

	// https://streams.spec.whatwg.org/#rs-model
	var DuplexStream = jsenv.require('duplex-stream');
	var Headers = jsenv.require('http-headers');
	var Body = jsenv.require('http-body');

	var HttpRequest = Function.create(Object.assign(Body, {
		readyState: 'closed',
		method: 'GET',
		url: null,
		headers: {},
		body: null,

		redirectMode: 'follow', // 'error', 'manual'
		redirectCount: 0,
		cacheMode: 'default', // 'no-store', 'reload', 'no-cache', 'force-cache', 'only-if-cached'
		currentUrl: null, // must be the last url of urllist

		constructor: function(options){
			options = options || {};
			if( options.headers ) options.headers = Object.assign({}, this.headers, options.headers);
			Object.assign(this, options);

			if( this.body && (this.method == 'GET' || this.method == 'HEAD') ){
				throw new TypeError('bo nody allowed for get/head requests');
			}

			this.url = new URL(this.url);
			this.headers = new Headers(this.headers);
			this.readyState = 'closed';
			this.currentUrl = this.url;
		},

		clone: function(){
			var cloneRequest = new HttpRequest({
				method: this.method,
				url: this.url,
				headers: this.headers.toJSON(),
				body: null
			});

			if( this.body ){
				var out = this.body.tee();
				this.body = out[0];
				cloneRequest.body = out[1];
			}

			return cloneRequest;
		},

		connect: function(){
			throw new Error('unimplemented connect()');
		},

		abort: function(){
			throw new Error('unimplemented abort()');
		},

		onerror: function(error){

		},

		ontimeout: function(){

		},

		onopen: function(){

		},

		onclose: function(){

		},

		open: function(){
			if( this.readyState == 'closed' ){
				this.readyState = 'connecting';
				this.connection = this.connect();
				console.log(this.method, String(this.url));
			}
			else{
				this.onerror(new Error('open() error : request readyState must be "closed", not "' + this.readyState + '"'));
			}
		},

		opened: function(status, headers, body){
			if( this.readyState === 'connecting' ){
				this.readyState = 'opened';
				this.onopen(status, headers, body);
				console.log(status, String(this.url));

				if( body ){
					body.then(function(){
						this.closed();
					}.bind(this));
				}
				else{
					this.closed();
				}
			}
			else{
				this.onerror(new Error('opened() error : request readyState must be "connecting", not "' + this.readyState + '"'));
			}
		},

		closed: function(){
			if( this.readyState === 'opened' ){
				this.readyState = 'closed';
				this.connection = null;
				this.onclose();
			}
			else{
				this.onerror(new Error('closed() error : request readyState must be "opened", not "' + this.readyState + '"'));
			}
		},

		close: function(){
			if( this.readyState === 'opened' || this.readyState === 'connecting' ){
				this.abort();
				this.closed();
			}
		}
	}));

	jsenv.define('http-request', HttpRequest);

})();