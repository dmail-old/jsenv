(function(){

	var DuplexStream = jsenv.require('duplex-stream');
	var Headers = jsenv.require('http-headers');

	var HttpResponse = Function.create({
		status: 0,
		headers: {},
		body: null,

		cacheState: 'none', // 'local', 'validated', 'partial'

		constructor: function(options){
			options = options || {};

			Object.assign(this, options);

			this.headers = new Headers(this.headers);
			this.body = new DuplexStream(this.body);
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
