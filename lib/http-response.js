(function(){

	var HttpResponse = Function.create({
		status: 0,
		headers: {},
		buffers: [],
		length: 0,
		body: null,

		constructor: function(){

		},

		onwrite: function(data){

		},

		writeHead: function(status, headers){
			this.status = status;
			this.headers = headers || HttpResponse.headers;
			this.buffers = [];
			this.length = 0;
		},

		write: function(data){
			this.buffers.push(data);
			this.length+= data.length;
			this.onwrite(data);
		}
	});

	var HttpRequest = Function.create({
		method: null,
		url: null,
		headers: null,
		body: null,
		readyState: null,

		constructor: function(options, response){
			Object.assign(this, options);
			this.response = response || new HttpResponse();
		},

		connect: function(){
			throw new Error('unimplemented connect()');
		},

		abort: function(){
			throw new Error('unimplemented abort()');
		},

		onerror: function(error){

		},

		ontimeout: function(){

		},

		onopen: function(){

		},

		onclose: function(){

		},

		open: function(){
			this.readyState = 'connecting';
			this.connection = this.connect();
		},

		end: function(){
			this.readyState = 'closed';
			this.onclose();
		},

		close: function(){
			if( this.readyState == 'closed' ) throw new Error('already closed connection');

			this.abort();
			// it should reset response status, headers, body, buffers & length
			this.connection = null;
			this.end();
		}
	});

	var HttpClient = Function.create({
		retryTimeout: 100,
		redirectLimit: 10,

		lastRetry: 0,
		redirectCount: 0,
		retryUrl: null,

		pipes: [
			// https://developer.github.com/v3/#http-redirects
			function redirect(){
				var status = this.getResponseStatus();
				if( status == 301 || status == 302 || status == 307 ){
					if( this.hasResponseHeader('location') ){
						return this.redirect(this.getResponseHeader('location'));
					}
					else{
						throw new Error('location header missing');
					}
				}
			},
			function retry(){
				var status = this.getResponseStatus();
				if( status == 503 && this.hasResponseHeader('retry-after') ){
					return this.retry(this.getResponseHeader('retry-after'));
				}
			},
			function resolve(){
				return this.resolve(this.response);
			}
		],

		constructor: function(request, response){
			this.request = request;
			this.response = response;

			this.promise = new Promise(function(resolve, reject){
				this.resolve = resolve;
				this.reject = reject;
			}.bind(this));

			this.request.onerror = function(error){
				this.reject(error);
			}.bind(this);
			this.request.ontimeout = function(){
				this.reject();
			}.bind(this);
			this.request.onopen = function(){
				this.handleResponse();
			}.bind(this);

			this.open();
		},

		then: function(a, b){
			return this.promise.then(a, b);
		},

		hasResponseHeader: function(name){
			return this.response.headers && name in this.response.headers;
		},

		getResponseHeader: function(name){
			return this.response.headers[name];
		},

		getResponseStatus: function(){
			return this.response.status;
		},

		handleResponse: function(){
			var responsePromise = Promise.resolve(this.response);

			this.pipes.forEach(function(pipe){
				responsePromise = responsePromise.then(pipe.bind(this));
			}, this);
		},

		open: function(){
			if( this.retryUrl ) this.request.url = this.retryUrl;
			this.request.open();
		},

		retry: function(delay){
			var lastRetry = this.lastRetry;
			var retryDuration = lastRetry + delay;
			var self = this;

			if( retryDuration <= this.retryTimeout ){ // max retry duration not reached
				this.request.close();
				this.lastRetry = retryDuration;

				return new Promise(function(resolve, reject){
					setTimeout(function(){
						resolve(self.open());
					}, delay);
				});
			}
		},

		redirect: function(url){
			if( this.redirectCount < this.redirectLimit ){ // max redirect limit not reached
				this.request.close();
				this.redirectCount++;

				// temporary redirect must do the request to the old url on retry
				if( this.getResponseStatus() === 307 ){
					this.retryUrl = this.request.url;
				}
				else{
					this.retryUrl = url;
				}

				this.request.url = url;

				return this.send();
			}
		},

		abort: function(){
			this.request.close();
			this.resolve = this.reject = this.retry = this.redirect = this.send = function(){};
		}
	});

})();