var http = require('http');
var https = require('https');
var parse = require('url').parse;

var Request = {
	constructor: function(options){
		var parsedUrl = parse(options.url);
		var isHttps = parsedUrl.protocol === 'https://';

		this.url = options.url;
		this.method = options.method;
		this.port = options.port || (isHttps ? 443 : 80);
		this.headers = options.headers;

		this.promise = new Promise(function(resolve, reject){
			this.resolve = resolve;
			this.reject = reject;
		}.bind(this));		

		var httpRequest = (isHttps ? https : http).request(this);
		this.httpRequest = httpRequest;

		httpRequest.addListener('response', this.fromResponse.bind(this));
		httpRequest.addListener('error', this.reject.bind(this));
		httpRequest.addListener('timeout', this.reject.bind(this));
		httpRequest.addListener('close', this.reject.bind(this));

		return this;
	},

	then: function(a, b){
		return this.promise.then(a, b);
	},

	complete: function(){
		if( this.status >= 200 || this.status < 400 ){
			this.resolve(this.responseText);
		}
		else{
			this.reject();
		}
	},

	fromResponse: function(response){
		this.status = response.statusCode;
		this.responseHeaders = response.headers;

		if( this.httpRequest.body ){
			var buffers = [];

			response.addListener('data', function(chunk){
				buffers.push(chunk);
			});
			response.addListener('end', function(){
				this.response = Buffer.concat(buffers);
				this.responseText = this.response.toString();
				this.complete();
			}.bind(this));
			response.addListener('error', this.reject.bind(this));
		}
		else{
			this.complete();
		}
	}
};