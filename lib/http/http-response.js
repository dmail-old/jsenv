(function(){

	var DuplexStream = jsenv.require('duplex-stream');

	var HttpResponse = Function.create({
		status: 0,
		headers: {},
		body: null,

		constructor: function(){

		},

		writeHead: function(status, headers){
			this.status = status || HttpResponse.status;
			this.headers = headers || HttpResponse.headers;
			this.body = new DuplexStream();
		},

		write: function(data){
			this.body.write(data);
		},

		writeEnd: function(data){
			if( typeof data === 'string' ){
				this.write(data);
				this.close();
			}
			else if( typeof data === 'object' && data != null ){
				this.body.pipeFrom(data);
			}
			else{
				throw new TypeError('data must be an object or a string');
			}
		},

		close: function(){
			this.body.close();
		}
	});

	jsenv.define('http-response', HttpResponse);

})();