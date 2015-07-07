(function(){

	var DuplexStream = jsenv.require('duplex-stream');

	var HttpResponse = Function.create({
		status: 0,
		headers: {},
		body: null,

		cacheState: 'none', // 'local', 'validated', 'partial'

		constructor: function(){

		},

		open: function(status, headers, body){
			this.status = status || HttpResponse.prototype.status;
			this.headers = headers || HttpResponse.prototype.headers;
			this.body = new DuplexStream(body);
		},

		write: function(data){
			this.body.write(data);
		},

		close: function(){
			this.body.close();
		},
		
		text: function(){
			return this.body.readAsString();
		},
		
		json: function(){
			return this.text().then(JSON.parse);
		}
	});

	jsenv.define('http-response', HttpResponse);

})();
