jsenv.define('platform-http', function(){
	var http = require('http');
	var https = require('https');
	var parse = require('url').parse;

	function createResponse(options){
		var url = options.url;
		var parsed = parse(url), secure;
		Object.assign(options, parsed);
		secure = options.protocol === 'https:';
		options.port = secure ? 443 : 80;

		var request = (secure ? https : http).request(options), response = jsenv.store.createHttpResponse();

		request.on('error', function(e){
			response.onerror(e);
		});
		request.on('timeout', function(){
			request.close();
			response.ontimeout();
		});

		request.on('response', function(httpResponse){
			response.open(httpResponse.statusCode, httpResponse.headers);

			httpResponse.on('data', function(chunk){
				response.write(chunk);
			});
			httpResponse.on('end', function(error){
				response.body = Buffer.concat(response.buffers, response.length);
				response.close();
			});
			httpResponse.on('error', function(error){
				response.error(error);
			});
		});

		response.setTimeout = function(timeout){
			request.setTimeout(timeout);
		};
		response.send = function(){
			if( options.body ){
				request.write(options.body);
			}
			else{
				request.end();
			}
		};
		response.abort = function(){
			request.abort();
		};

		return response;
	}

	return createResponse;
});