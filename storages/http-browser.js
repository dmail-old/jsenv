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
		setTimeout: function(timeout){
			this.connection.timeout = timeout;
			this.connection.ontimeout = function(){
				this.request.ontimeout();

				var error = new Error('server taking too long to respond');
				error.code = 'ECONNRESET';
				this.request.onerror(error);
			}.bind(this);
		},

		connect: function(){
			var connection = new XMLHttpRequest(), request = this, offset = 0, options = this.options;

			connection.onerror = function(e){
				request.onerror(e);
			};
			connection.onreadystatechange = function(){
				if( this.readyState === 2 ){
					request.opened(this.status, parseHeaders(this.getAllResponseHeaders()));
				}
				else if( this.readyState === 3 ){
					var data = this.responseText;

					if( offset ) data = data.slice(offset);
					offset+= data.length;

					request.progress(data);
				}
				else if( this.readyState === 4 ){
					request.closed();
				}
			};

			try{
				connection.open(this.method, this.url);

				for(var key in this.headers){
					connection.setRequestHeader(key, this.headers[key]);
				}

				this.body.readAsString().then(function(body){
					connection.send(body);
				});
			}
			catch(e){
				this.onerror(e);
			}

			return connection;
		},

		abort: function(){
			this.connection.abort();
			this.connection.onreadystatechange = null;
			this.connection.onerror = null;
		}
	};

	return function(){
		return Function.extend(jsenv.http.Request, BrowserHttpRequest);
	};
});