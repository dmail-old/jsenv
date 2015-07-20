(function(){
	var DuplexStream = jsenv.require('duplex-stream');
	var HttpRequest = jsenv.require('http-request');

	var BrowserHttpRequest = Function.extend(HttpRequest, {
		connect: function(){
			var xhr = new XMLHttpRequest(), request = this;

			var promise = request.text().then(function(text){
				return new Promise(function(resolve, reject){
					xhr.onerror = function(e){
						reject(e);
					};

					var responseBody = new DuplexStream(), offset = 0;
					xhr.onreadystatechange = function(){
						if( xhr.readyState === 2 ){
							resolve({
								status: xhr.status,
								headers: xhr.getAllResponseHeaders(),
								body: responseBody
							});
						}
						else if( xhr.readyState === 3 ){
							var data = xhr.responseText;

							if( offset ) data = data.slice(offset);
							offset+= data.length;

							responseBody.write(data);
						}
						else if( xhr.readyState === 4 ){
							responseBody.close();
						}
					};

					xhr.open(request.method, String(request.currentUrl));

					request.headers.forEach(function(headerName, headerValue){
						xhr.setRequestHeader(headerName, headerValue);
					});

					xhr.send(text);
				});
			});

			return {
				promise: promise,

				setTimeout: function(timeout, listener){
					xhr.timeout = timeout;
					xhr.connection.ontimeout = listener;
				},

				abort: function(){
					xhr.abort();
					xhr.onreadystatechange = null;
					xhr.onerror = null;
				}
			};
		}
	});

	jsenv.define('http-request-platform', BrowserHttpRequest);

})();