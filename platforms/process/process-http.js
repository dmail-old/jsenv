jsenv.platform.register('http', function(){
	var http = require('http');
	var https = require('https');
	var parse = require('url').parse;

	function createRequest(url, options){
		var parsed = parse(url), secure;

		Object.assign(options, parsed);

		secure = options.protocol === 'https:';

		options.port = secure ? 443 : 80;

		return new Promise(function(resolve, reject){
			var httpRequest = (secure ? https : http).request(options);

			console.log(options.method, url);

			function resolveWithHttpResponse(httpResponse){
				var buffers = [], length = 0;
				httpResponse.addListener('data', function(chunk){
					buffers.push(chunk);
					length+= chunk.length;
				});
				httpResponse.addListener('end', function(){
					resolve({
						status: httpResponse.statusCode,
						headers: httpResponse.headers,
						body: Buffer.concat(buffers, length).toString()
					});
				});
				httpResponse.addListener('error', reject);
			}

			httpRequest.addListener('response', resolveWithHttpResponse);
			httpRequest.addListener('error', reject);
			httpRequest.addListener('timeout', reject);
			httpRequest.addListener('close', reject);

			if( options.body ){
				httpRequest.write(options.body);
			}
			else{
				httpRequest.end();
			}

			// timeout
			setTimeout(function(){ reject(new Error("Timeout")); }, 20000);
		});
	}

	return createRequest;
});