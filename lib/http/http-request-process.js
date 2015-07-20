(function(){
	var http = require('http');
	var https = require('https');
	//var parse = require('url').parse;
	var DuplexStream = jsenv.require('duplex-stream');
	var HttpRequest = jsenv.require('http-request');

	var ProcessHttpRequest = Function.extend(HttpRequest, {
		headers: {
			'user-agent': jsenv.platform.name,
			'origin': jsenv.platform.baseURL
		},

		connect: function(){
			var url, isHttps, httpRequest, options;

			url = this.currentUrl;
			isHttps = url.protocol === 'https:';

			options = {
				method: this.method,
				host: url.hostname,
				port: url.port || (isHttps ? 443 : 80),
				path: url.pathname + url.search,
				headers: this.headers.toJSON()
			};

			httpRequest = (isHttps ? https : http).request(options);
			this.body.pipeTo(httpRequest);

			var promise = new Promise(function(resolve, reject){

				httpRequest.on('error', function(e){
					reject(e);
				});

				httpRequest.on('response', function(incomingMessage){
					resolve({
						status: incomingMessage.statusCode,
						headers: incomingMessage.headers,
						body: new DuplexStream(incomingMessage)
					});
				});

			});

			return {
				promise: promise,

				setTimeout: function(timeout, listener){
					httpRequest.setTimeout(timeout);
					httpRequest.on('timeout', function(){
						httpRequest.close();
						listener();
					});
				},

				abort: function(){
					httpRequest.abort();
					httpRequest.removeAllListeners('response');
				}
			};
		}
	});

	jsenv.define('http-request-platform', ProcessHttpRequest);

})();