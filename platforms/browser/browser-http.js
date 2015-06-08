jsenv.define('http', function(){
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


	function createRequest(url, options){
		return new Promise(function(resolve, reject){
			var xhr = new XMLHttpRequest();

			xhr.open(options.method, url);
			if( options.headers ){
				for(var key in options.headers){
					xhr.setRequestHeader(key, options.headers[key]);
				}
			}

			xhr.onerror = reject;
			xhr.onreadystatechange = function(){
				if( xhr.readyState === 4 ){
					resolve({
						status: xhr.status,
						body: xhr.responseText,
						headers: parseHeaders(xhr.getAllResponseHeaders())
					});
				}
			};
			xhr.send(options.body || null);
		});
	}

	return createRequest;
});