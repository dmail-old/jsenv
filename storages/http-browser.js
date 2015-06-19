jsenv.define('platform-http', function(){
	// https://gist.github.com/mmazer/5404301
	function parseHeaders(headerString){
		var headers = {}, pairs, pair, index, i, j, key, value;

		if( headerString ){
			pairs = headerString.split('\u000d\u000a');
			i = 0;
			j = pairs.length;
			for(;i<j;i++){
				pair = pairs[i];
				index = pair.indexOf('\u003a\u0020');
				if( index > 0 ){
					key = pair.slice(0, index);
					value = pair.slice(index + 2);
					headers[key] = value;
				}
			}
		}

		return headers;
	}

	var BrowserHttpRequest = {
		connect: function(){
			var connection = new XMLHttpRequest(), request = this, response = this.response, offset = 0, options = this.options;

			connection.onerror = function(e){
				request.onerror(e);
			};
			connection.ontimeout = function(){
				request.ontimeout();
			};
			connection.onreadystatechange = function(){
				if( this.readyState === 2 ){
					response.writeHead(this.status, parseHeaders(this.getAllResponseHeaders()));
					request.onopen();
				}
				else if( this.readyState === 3 ){
					var data = this.responseText;

					if( offset ) data = data.slice(offset);
					offset+= data.length;

					response.write(data);
				}
				else if( this.readyState === 4 ){
					response.body = this.responseText;
					request.end();
				}
			};

			try{
				connection.open(this.method, this.url);

				for(var key in this.headers){
					connection.setRequestHeader(key, this.headers[key]);
				}

				connection.send(this.body);
			}
			catch(e){
				this.onerror(e);
			}

			return connection;
		},

		abort: function(){
			this.connection.abort();
		},

		setTimeout: function(timeout){
			this.connection.timeout = timeout;
		}
	};

	return function(){
		return Function.extend(jsenv.store.HttpRequest, BrowserHttpRequest);
	};
});