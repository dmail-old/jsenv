(function(){

	var HttpRequest = Function.create({
		Response: jsenv.require('http-response'),
		method: null,
		url: null,
		headers: null,
		body: null,
		readyState: null,

		constructor: function(options){
			this.readyState = 'closed';
			Object.assign(this, options);
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
			}
			else{
				this.onerror(new Error('open() error : request readyState must be "closed", not "' + this.readyState + '"'));
			}
		},

		writeHead: function(status, headers){
			if( this.readyState === 'connecting' ){
				this.readyState = 'opened';
				this.response = this.response || new this.Response();
				this.response.writeHead(status, headers);
				this.onopen();
			}
			else{
				this.onerror(new Error('writeHead() error : request readyState must be "connecting", not "' + this.readyState + '"'));
			}
		},

		write: function(data){
			if( this.readyState === 'opened' ){
				this.response.write(data);
				this.onwrite();
			}
			else{
				this.onerror(new Error('write() error : request readyState must be "opened", not "' + this.readyState + '"'));
			}
		},

		writeEnd: function(body){
			if( this.readyState === 'opened' ){
				this.response.body = body;
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
				this.writeEnd();
			}
		}
	});

	jsenv.define('http-request', HttpRequest);

})();