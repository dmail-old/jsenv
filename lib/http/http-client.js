(function(){
	// http://jakearchibald.com/2015/thats-so-fetch/
	// we may need to clone the response stream (at least when it comes from cache)
	// http://www.html5rocks.com/en/tutorials/service-worker/introduction/?redirect_from_locale=fr

	var HttpRequest = jsenv.require('http-request');
	var HttpResponse = jsenv.require('http-response');

	function compareHeader(headerName, headersA, headersB){
		return headersA.get(headerName) === headersB.get(headerName);
	}

	function compareHeaders(headerNames, headersA, headersB){
		return headerNames.every(function(headerName){
			return compareHeader(headerName, headersA, headersB);
		});
	}

	function compareVaryHeaders(response, request){
		if( response.headers.has('vary') ){
			var headerNames = response.headers.get('vary').split(',');
			return compareHeaders(headerNames, response.headers, request.headers);
		}
		return true;
	}

	function compareUrl(requestA, requestB){
		return requestA.url === requestB.url;
	}

	function compareMethod(requestA, requestB){
		return requestA.method === requestB.method;
	}

	if( false === 'includes' in Array.prototype ){
		Array.prototype.includes = function(item, from){
			return this.indexOf(item, from) !== -1;
		};
	}

	var HttpCache = Function.create({
		constructor: function(){
			this.entries = [];
		},

		set: function(request, response){
			if( typeof request === 'string' ){
				request = jsenv.http.createRequest({
					url: request
				});
			}

			var index = this.indexOf(request);

			request = request.clone();
			response = response.clone();
			response.cacheState = 'local';

			if( index === -1 ){
				this.entries.push({
					request: request,
					response: response
				});
			}
			else{
				this.entries[index].response = response;
			}
		},

		indexOf: function(request){
			var entries = this.entries, i = 0, j = entries.length, entry, cachedRequest, cachedResponse, index = -1;

			for(;i<j;i++){
				entry = entries[i];
				cachedRequest = entry.request;
				cachedResponse = entry.response;

				if( compareUrl(cachedRequest, request) &&
					compareMethod(cachedRequest, request) &&
					compareVaryHeaders(cachedResponse, request) ){
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

		noBodyMethod: ['HEAD', 'CONNECT'],
		noBodyStatus: [101, 204, 205, 304],
		redirectStatus: [301, 302, 307],
		retryStatus: [301, 302, 307, 503],

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
					this.handleResponse(this.createResponse({
						status: status,
						headers: headers,
						body: body
					}));
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

				if( cachedResponse ){
					// il y a des choses à faire avant de valider la réponse
					if( cachedResponse.headers.has('last-modified') ){
						request.headers.set('if-modified-since', cachedResponse.headers.get('last-modified'));
						request.open();
					}
					// resolve immediatly
					else if( cachedResponse.cacheState === 'validated' || cachedResponse.cacheState === 'local' ){
						this.handleResponse(cachedResponse.clone());
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

		handleResponse: function(response){
			var request = this.request, status = response.status;

			if( this.noBodyMethod.includes(request.method) || this.noBodyStatus.includes(status) ){
				response.body.cancel();
				response.body = null;
			}

			// cache
			var cache = this.cache;
			if( status === 304 ){
				var cachedEntry = cache.get(request);

				if( cachedEntry == null ){
					throw new NetWorkError('no cache for 304 response');
				}
				else{
					response = cachedEntry.response.clone();
					response.status = 200;
					response.cacheState = 'validated';
				}
			}
			if( request.cacheMode === 'default' || request.cacheMode === 'force-cache' || request.cacheMode === 'reload' ){
				cache.set(request, response);
			}

			// retry & redirect
			var retryDelay = 0;
			// redirection
			if( response.headers.has('location') && this.redirectStatus.includes(status) ){
				retryDelay = this.redirect(response.headers.get('location'), status == 307);
			}
			// retry
			if( response.headers.has('retry-after') && this.retryStatus.includes(status) ){
				retryDelay = this.retry(response.headers.get('retry-after'));
			}

			if( typeof retryDelay === 'number' ){
				request.close();
				setTimeout(function(){ this.open(); }.bind(this), retryDelay);
			}
			else{
				this.resolve(response);
			}
		}
	});

	jsenv.define('http-client', HttpClient);

})();