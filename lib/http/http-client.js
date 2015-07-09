(function(){
	// http://jakearchibald.com/2015/thats-so-fetch/
	// we may need to clone the response stream (at least when it comes from cache)
	// http://www.html5rocks.com/en/tutorials/service-worker/introduction/?redirect_from_locale=fr

	var HttpResponse = jsenv.require('http-response');

	function compareHeader(headerName, requestA, requestB){
		return requestA.headers.get(headerName) === requestB.headers.get(headerName);
	}

	function compareHeaders(headerNames, requestA, requestB){
		return headerNames.every(function(headerName){
			return compareHeader(headerName, requestA, requestB);
		});
	}

	function compareVaryHeaders(requestA, requestB){
		if( requestA.headers.has('vary') ){
			var headerNames = requestA.headers.get('vary').split(',');
			return compareHeaders(headerNames, requestA, requestB);
		}
		return true;
	}

	function compareUrl(requestA, requestB){
		return requestA.url === requestB.url;
	}

	function compareMethod(requestA, requestB){
		return requestA.method === requestB.method;
	}

	var HttpCache = Function.create({
		constructor: function(){
			this.entries = [];
		},

		set: function(request, response){
			this.entries.push({
				request: request,
				response: response
			});
		},

		indexOf: function(request){
			var entries = this.entries, i = 0, j = entries.length, entry, cachedRequest, index = -1;

			for(;i<j;i++){
				entry = entries[i];
				cachedRequest = entry.request;

				if( compareUrl(cachedRequest, request) &&
					compareMethod(cachedRequest, request) &&
					compareVaryHeaders(cachedRequest, request) ){
					index = i;
					break;
				}
			}

			return index;
		},

		get: function(request){
			var index = this.indexOf(request);
			return index === -1 ? null : this.entries[index];
		},

		delete: function(request){
			var index = this.indexOf(request);

			if( index > -1 ){
				this.entries.splice(index, 1);
				return true;
			}
			return false;
		}
	});

	var NetWorkError = Function.extend(Error, {
		constructor: function(message){
			this.name = 'NetWorkError';
			this.message = message || 'not specified';
		}
	});

	var HttpClient = Function.create({
		retryTimeout: 100,
		redirectLimit: 20,
		lastRetry: 0,
		aborted: false,
		cache: new HttpCache(),
		cachedResponse: null,

		constructor: function(request){
			this.promise = new Promise(function(resolve, reject){
				this.resolve = resolve;
				this.reject = reject;
			}.bind(this));

			this.request = request;

			this.request.onerror = function(e){
				this.reject(e);
			}.bind(this);
			this.request.ontimeout = function(){
				this.reject('timeout');
			}.bind(this);
			this.request.onopen = function(status, headers, body){
				try{
					this.handleResponse(status, headers, body);
				}
				catch(e){
					this.reject(e);
				}
			}.bind(this);
		},

		then: function(a, b){
			return this.promise.then(a, b);
		},

		open: function(){
			if( false === this.aborted ){
				var request = this.request;
				var cacheMode = request.cacheMode;
				var cachedEntry, cachedResponse;

				if( cacheMode == 'default' ){
					cachedEntry = this.cache.get(request);
					cachedResponse = cachedEntry ? cachedEntry.response : null;
				}

				this.cachedResponse = cachedResponse;

				if( cachedResponse ){
					// resolve immediatly
					if( cachedResponse.cacheState === 'validated' || cachedResponse.cacheState === 'local' ){
						this.handleResponse(
							cachedResponse.status,
							cachedResponse.headers,
							cachedResponse.body
						);
					}
					// il y a des choses à faire avant de valider la réponse
					else if( cachedResponse.cacheState === 'partial' ){
						request.headers.set('if-modified-since', cachedResponse.headers.get('last-modified'));
						request.open();
					}
				}
				else{
					request.open();
				}
			}
		},

		close: function(){
			this.request.close();
		},

		abort: function(){
			this.aborted = true;
			this.close();
		},

		retry: function(delay){
			if( typeof delay === 'string' ){
				if( isNaN(delay) ){
					try{
						delay = new Date(delay);
					}
					catch(e){
						throw e;
					}
				}
				else{
					delay = delay % 1 === 0 ? parseInt(delay) : parseFloat(delay);
					delay*= 1000; // delay headers is in seconds but we need ms
				}
			}
			if( delay instanceof Date ){
				delay = delay - new Date();
			}
			if( typeof delay != 'number' ){
				throw new TypeError('delay expects a date or a number');
			}
			if( delay < 0 ){
				throw new RangeError('delay must be a future date or a positive number');
			}

			var lastRetry = this.lastRetry;
			var retryDuration = lastRetry + delay;

			// max retry duration reached
			if( retryDuration >= this.retryTimeout ){
				throw new NetWorkError('max retry duration reached');
			}

			this.lastRetry = retryDuration;
			return delay;
		},

		redirect: function(url, temporary){
			if( this.request.redirectMode === 'error' ){
				throw new NetWorkError('redirection not supported by redirectMode');
			}
			if( this.request.redirectMode === 'follow' ){
				// max redirect limit reached
				if( this.request.redirectCount >= this.redirectLimit ){
					throw new NetWorkError('redirect limit reached');
				}

				this.request.redirectCount++;
				url = new URL(url);
				this.request.currentUrl = url;

				return 0;
			}
		},

		createResponse: function(options){
			return new HttpResponse(options);
		},

		handleResponse: function(status, headers, body){
			var response = this.createResponse({
				status: status,
				headers: headers,
				body: body
			});

			if( this.request.method === 'HEAD' || this.request.method === 'CONNECT' ||
				status === 101 || status === 204 || status === 205 || status === 304 ){
				response.body = null;
			}

			// cette réponse il faudrait la mettre en cache
			if( response.headers.has('last-modified') ){
				response.cacheState = 'partial';
			}

			this.cache.set(this.request, response);

			status = response.status;

			var retryDelay = 0;

			if( status == 301 || status == 302 || status == 307 ){
				if( response.headers.has('location') ){
					retryDelay = this.redirect(response.headers.get('location'), status == 307);
				}
			}
			if( status == 503 || status === 301 || status === 302 || status === 307 ){
				if( response.headers.has('retry-after') ){
					retryDelay = this.retry(response.headers.get('retry-after'));
				}
			}
			// there is a cache for this request but server responded that it's modified
			if( this.cachedResponse && this.status != 304 ){
				this.cache.delete(this.request);
			}

			if( typeof retryDelay === 'number' ){
				this.request.close();
				setTimeout(function(){
					this.open();
				}.bind(this), retryDelay);
			}
			else{
				if( status === 304 ){
					if( !this.cachedResponse ){
						throw new NetWorkError('no cache for 304 response');
					}
					else{
						response = this.createResponse(this.cachedResponse);
						response.status = 200;
						response.cacheState = 'validated';
					}
				}

				this.resolve(response);
			}
		}
	});

	jsenv.define('http-client', HttpClient);

})();