(function(){
	var DuplexStream = jsenv.require('duplex-stream');

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
			var responseBody = new DuplexStream();

			connection.onerror = function(e){
				request.onerror(e);
			};
			connection.onreadystatechange = function(){
				if( this.readyState === 2 ){
					request.opened(this.status, this.getAllResponseHeaders(), responseBody);
				}
				else if( this.readyState === 3 ){
					var data = this.responseText;

					if( offset ) data = data.slice(offset);
					offset+= data.length;

					responseBody.write(data);
				}
				else if( this.readyState === 4 ){
					responseBody.close();
				}
			};

			try{
				connection.open(this.method, String(this.currentUrl));

				this.headers.forEach(function(headerName, headerValue){
					connection.setRequestHeader(headerName, headerValue);
				});

				this.text().then(function(body){
					connection.send(body);
				}).catch(function(e){
					this.onerror(e);
				}.bind(this));
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

	jsenv.define('http-request-platform', BrowserHttpRequest);

})();