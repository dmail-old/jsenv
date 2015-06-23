jsenv.define('platform-http', function(){
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

		setSource: function(source){
			if( typeof source === 'string' ){
				this.writeEnd(source);
			}
			else if( typeof source === 'object' && source != null ){
				var request = this;

				this.listeners = {
					error: function(e){ request.onerror(e); },
					data: function(data){ request.write(data); },
					end: function(){ request.writeEnd(Buffer.concat(request.response.buffers, request.response.length)); }
				};

				this.stream = source;

				for(var key in this.listeners){
					this.stream.addListener(key, this.listeners[key]);
				}
			}
			else{
				this.writeEnd();
			}
		},

		clearSource: function(){
			if( this.stream ){
				for(var key in this.listeners){
					this.stream.removeListener(key, this.listeners[key]);
				}
				this.stream = null;
			}
		},

		connect: function(){
			var connection, request = this;
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
				request.writeHead(incomingMessage.statusCode, incomingMessage.headers);
				request.setSource(incomingMessage);
			});

			// connection.setNoDelay(true); // disable naggle algorithm (naggle buffers request.write() calls untils they are big enough)
			connection.end(this.body);
		},

		abort: function(){
			this.connection.abort();
			this.connection.removeListener('response');
			this.clearSource();
		}
	};

	return function(){
		return Function.extend(jsenv.http.Request, ProcessHttpRequest);
	};
});