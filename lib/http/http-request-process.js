(function(){
	var http = require('http');
	var https = require('https');
	//var parse = require('url').parse;

	var ProcessHttpRequest = {
		headers: {
			'user-agent': jsenv.platform.name,
			'origin': jsenv.platform.baseURL
		},

		setTimeout: function(timeout){
			this.connection.setTimeout(timeout);
			this.connection.on('timeout', function(){
				this.connection.close();
				this.ontimeout();
			}.bind(this));
		},

		connect: function(){
			var request, response, url, isHttps, connection, options;

			request = this;
			response = this.response;
			url = new URL(this.url);
			isHttps = url.protocol === 'https:';
			options = {
				method: this.method,
				host: url.hostname,
				port: url.port || (isHttps ? 443 : 80),
				path: url.pathname + url.search,
				headers: this.headers
			};

			connection = (isHttps ? https : http).request(options);

			connection.on('error', function(e){
				request.onerror(e);
			});

			connection.on('response', function(incomingMessage){
				request.opened(incomingMessage.statusCode, incomingMessage.headers, incomingMessage);
			});

			this.body.pipeTo(connection);
		},

		abort: function(){
			this.connection.abort();
			this.connection.removeListener('response');
		}
	};

	jsenv.define('http-request-platform', ProcessHttpRequest);

})();