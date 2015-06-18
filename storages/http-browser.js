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

	function createResponse(options){
		var request = new XMLHttpRequest(), response = jsenv.store.createHttpResponse();

		try{
			request.open(options.method, options.url);

			if( options.headers ){
				for(var key in options.headers){
					request.setRequestHeader(key, options.headers[key]);
				}
			}

			//request.overrideMimeType('text\/plain; charset=x-user-defined');
			//request.responseType = 'arraybuffer';

			request.onerror = function(e){
				response.onerror(e);
			};
			request.ontimeout = function(){
				response.ontimeout();
			};
			var offset = 0;
			request.onreadystatechange = function(){
				if( request.readyState === 2 ){
					response.open(request.status, parseHeaders(request.getAllResponseHeaders()));
				}
				else if( request.readyState === 3 ){
					var data = request.repsonseText;

					if( offset ) data = data.slice(offset);
					offset+= data.length;

					response.write(data);
				}
				else if( request.readyState === 4 ){
					response.body = request.responseText;
					response.close();
				}
			};
			response.setTimeout = function(timeout){
				request.timeout = timeout;
			};
			response.send = function(){
				request.send(options.body || null);
			};
			response.abort = function(){
				request.abort();
			};
		}
		catch(e){
			response.onerror(e);
		}

		return response;
	}

	return createResponse;
});