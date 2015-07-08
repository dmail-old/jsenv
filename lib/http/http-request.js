(function(){

	// https://streams.spec.whatwg.org/#rs-model
	var DuplexStream = jsenv.require('duplex-stream');
	var HttpResponse = jsenv.require('http-response');
	var Headers = jsenv.require('http-headers');

	var HttpRequest = Function.create({
		Response: HttpResponse,
		method: null,
		url: null,
		headers: {},

		redirectMode: 'follow', // 'error', 'manual'
		redirectCount: 0,
		urlList: null, // a list of url for this request
		cacheMode: 'default', // 'no-store', 'reload', 'no-cache', 'force-cache', 'only-if-cached'
		currentUrl: null, // must be the last url of urllist
		done: false,

		constructor: function(options){
			this.readyState = 'closed';

			options = options || {};

			this.headers = new Headers(this.headers);
			this.body = new DuplexStream(options.body);
			this.response = new this.Response();

			if( options.method ) this.method = options.method;
			if( options.url ) this.url = options.url;
			if( options.headers ){
				Object.keys(options.headers).forEach(function(headerName){
					this.headers.append(headerName, options.headers[headerName]);
				}, this);
			}
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
				this.response.open(status, headers, body);
				this.onopen(this.response);
				console.log(this.response.status, String(this.url));
			}
			else{
				this.onerror(new Error('writeHead() error : request readyState must be "connecting", not "' + this.readyState + '"'));
			}
		},

		progress: function(data){
			if( this.readyState === 'opened' ){
				this.response.write(data);
			}
			else{
				this.onerror(new Error('progress() error : request readyState must be "opened", not "' + this.readyState + '"'));
			}
		},

		closed: function(){
			if( this.readyState === 'opened' ){
				this.response.close();
				this.readyState = 'closed';
				this.connection = null;
				this.onclose();
			}
			else{
				this.onerror(new Error('writeEnd() error : request readyState must be "opened", not "' + this.readyState + '"'));
			}
		},

		close: function(){
			if( this.readyState === 'opened' || this.readyState === 'connecting' ){
				this.abort();
				this.closed();
			}
		}
	});

	jsenv.define('http-request', HttpRequest);

})();