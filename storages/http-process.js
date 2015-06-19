jsenv.define('platform-http', function(){
	var http = require('http');
	var https = require('https');
	//var parse = require('url').parse;

	var ProcessHttpRequest = {
		setTimeout: function(timeout){
			this.connection.setTimeout(timeout);
		},

		connect: function(){
			var connection, request = this, response = this.response;
			var url = new URL(this.url), isHttps = url.protocol === 'https:';

			connection = (isHttps ? https : http).request({
				method: this.method,
				host: url.host,
				port: url.port || (isHttps ? 443 : 80),
				path: url.pathname + url.search,
				headers: this.headers
			});

			connection.on('error', function(e){
				request.onerror(e);
			});
			connection.on('timeout', function(){
				connection.close();
				request.ontimeout();
			});
			connection.on('response', function(response){
				response.writeHead(response.statusCode, response.headers);
				request.onopen();

				response.on('error', function(e){
					request.onerror(e);
				});

				response.on('data', function(chunk){
					response.write(chunk);
				});

				response.on('end', function(){
					response.body = Buffer.concat(response.buffers, response.length);
					request.end();
				});
			});

			// connection.setNoDelay(true); // disable naggle algorithm (naggle buffers request.write() calls untils they are big enough)
			connection.end(this.body);
		},

		abort: function(){
			this.connection.abort();
		}
	};

	return function(){
		return Function.extend(jsenv.store.HttpRequest, ProcessHttpRequest);
	};
});