(function(){

	// https://streams.spec.whatwg.org/#rs-model
	var DuplexStream = jsenv.require('duplex-stream');
	var HttpResponse = jsenv.require('http-response');

	var HttpRequest = Function.create({
		Response: HttpResponse,
		method: null,
		url: null,
		headers: {},

		constructor: function(options){
			this.readyState = 'closed';

			options = options || {};

			this.headers = Object.assign({}, this.headers);
			this.body = new DuplexStream(options.body);
			this.response = new this.Response();

			if( options.method ) this.method = options.method;
			if( options.url ) this.url = options.url;
			if( options.headers ) this.headers = Object.assign(this.headers, options.headers);
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