(function(){

	var DuplexStream = jsenv.require('duplex-stream');

	var HttpResponse = Function.create({
		status: 0,
		headers: {},
		body: null,

		constructor: function(){

		},

		open: function(status, headers, body){
			this.status = status || HttpResponse.prototype.status;
			this.headers = headers || HttpResponse.prototype.headers;
			this.body = new DuplexStream();
		},

		write: function(data){
			this.body.write(data);
		},

		pipeFrom: function(readableStream){
			this.body.pipeFrom(readableStream);
		},

		close: function(){
			this.body.close();
		}
	});

	jsenv.define('http-response', HttpResponse);

})();