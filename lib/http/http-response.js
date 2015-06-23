(function(){
	var HttpResponse = Function.create({
		status: 0,
		headers: {},
		buffers: [],
		length: 0,
		body: null,

		constructor: function(){

		},

		writeHead: function(status, headers){
			this.status = status || HttpResponse.status;
			this.headers = headers || HttpResponse.headers;
			this.buffers = [];
			this.length = 0;
			this.body = null;
		},

		write: function(data){
			this.buffers.push(data);
			this.length+= data.length;
		}
	});

	jsenv.define('http-response', HttpResponse);

})();