(function(){
	var http = require('http');
	var https = require('https');
	//var parse = require('url').parse;

	var ProcessHttpRequest = {
		setTimeout: function(timeout){
			this.connection.setTimeout(timeout);
			this.connection.on('timeout', function(){
				this.connection.close();
				this.ontimeout();
			}.bind(this));
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

			connection.on('response', function(incomingMessage){
				request.opened(incomingMessage.statusCode, incomingMessage.header, incomingMessage);
			});

			this.body.pipeTo(connection);
		},

		abort: function(){
			this.connection.abort();
			this.connection.removeListener('response');
			this.request.close();
		}
	};

	jsenv.define('http-request-platform', ProcessHttpRequest);

})();