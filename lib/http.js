(function(){

	var HttpResponse = Function.create({
		status: 0,
		headers: {},
		buffers: [],
		length: 0,
		body: null,

		constructor: function(){

		},

		writeHead: function(status, headers){
			this.status = status || HttpResponse.status;
			this.headers = headers || HttpResponse.headers;
			this.buffers = [];
			this.length = 0;
			this.body = null;
		},

		write: function(data){
			this.buffers.push(data);
			this.length+= data.length;
		}
	});

	var HttpRequest = Function.create({
		method: null,
		url: null,
		headers: null,
		body: null,
		readyState: null,

		constructor: function(options){
			Object.assign(this, options);
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

		writeHead: function(status, headers){
			this.readyState = 'opened';
			this.response = this.response || new HttpResponse();
			this.response.writeHead(status, headers);
			this.onopen();
		},

		write: function(data){
			this.response.write(data);
			this.onwrite();
		},

		writeEnd: function(body){
			this.response.body = body;
			this.readyState = 'closed';
			this.connection = null;
			this.onclose();
		},

		close: function(){
			if( this.readyState == 'closed' ) return;

			this.abort();
			this.response.writeHead(); // reset status, headers, body, buffers & length
			this.writeEnd();
		}
	});

	var HttpClient = Function.create({
		retryTimeout: 100,
		redirectLimit: 10,

		lastRetry: 0,
		redirectCount: 0,
		retryUrl: null,
		isWaitingOpen: false,

		constructor: function(request, listener){
			this.request = request;
			this.listener = listener || this;

			this.request.onerror = function(e){
				this.emit('error', e);
			}.bind(this);
			this.request.ontimeout = function(){
				this.emit('timeout');
			}.bind(this);
			this.request.onopen = function(){
				this.state = 'opened';
				// only the last onopen
				if( this.handleResponse() ){
					this.emit('open');
				}
			}.bind(this);
			this.request.onwrite = function(data){
				this.emit('write', data);
			}.bind(this);
			this.request.onclose = function(){
				this.state = 'closed';
				if( false === this.isWaitingOpen ){ // only the last close
					this.emit('close');
				}
			}.bind(this);

			this.open();
		},

		emit: function(name, e){
			if( this.state != 'aborted' && 'on' + name in this.listener ){
				this.listener['on' + name](e);
			}
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

		pipes: [
			function redirect(){
				var status = this.getResponseStatus();
				if( status == 301 || status == 302 || status == 307 ){
					if( this.hasResponseHeader('location') ){
						return this.redirect(this.getResponseHeader('location'), status == 307);
					}
					else{
						this.onerror(new Error('location header missing'));
					}
				}
			},
			function retry(){
				var status = this.getResponseStatus();
				if( status == 503 || status === 301 || status === 302 || status === 307 ){
					if( this.hasResponseHeader('retry-after') ){
						return this.retry(this.getResponseHeader('retry-after'));
					}
				}
			}
		],

		handleResponse: function(){
			var pipes = this.pipes.reverse(), i = pipes.length, result, retry = false, retryDelay = 0;

			while( i-- ){
				result = pipes[i].call(this);

				if( typeof result === 'number' ){
					retryDelay = Math.max(retryDelay, result);
					retry = true;
				}
			}

			if( retry ){
				this.request.close();
				this.isWaitingOpen = true;
				setTimeout(function(){
					this.isWaitingOpen = false;
					this.open();
				}.bind(this), retryDelay);
				return false;
			}
			return true;
		},

		open: function(){
			if( this.state !== 'aborted' ){
				this.request.open();
			}
		},

		abort: function(){
			this.state = 'aborted';
			this.request.close();
		},

		retry: function(delay){
			if( typeof delay === 'string' ){
				if( isNaN(delay) ){
					try{
						delay = new Date(delay);
					}
					catch(e){
						return this.onerror(e);
					}
				}
				else{
					delay = parseFloat(delay);
				}
			}
			if( delay instanceof Date ){
				delay = delay - new Date();
			}
			if( typeof delay != 'number' ){
				return this.onerror(new TypeError('delay expects a date or a number'));
			}
			if( delay < 0 ){
				return this.onerror(new RangeError('delay must be a future date or a positive number'));
			}

			var lastRetry = this.lastRetry;
			var retryDuration = lastRetry + delay;

			if( retryDuration <= this.retryTimeout ){ // max retry duration not reached
				this.lastRetry = retryDuration;
				if( this.retryUrl ) this.request.url = this.retryUrl;

				return delay;
			}
		},

		redirect: function(url, temporary){
			if( this.redirectCount < this.redirectLimit ){ // max redirect limit not reached
				this.redirectCount++;

				// temporary redirect must do the request to the old url on retry
				this.retryUrl = temporary ? this.request.url : url;
				this.request.url = url;

				return 0;
			}
		}
	});

	var FakeHttpRequest = {
		createPromise: function(options){
			throw new Error('unimplemented createPromise()');
		},

		populateResponseFromPromise: function(promise){
			var connection = this.connection, request = this;

			return promise.then(function(response){
				if( connection.aborted ) return;

				if( typeof response === 'number' ) response = {status: response};

				request.writeHead(response.status, response.headers);
				request.setSource(response.body);
			}).catch(function(e){
				request.onerror(e);
			});
		},

		connect: function(){
			this.populateResponseFromPromise(this.createPromise(this.options));

			// crée une connexion qui ne peut écrire dans réponse qui si non-aborted
			return {
				aborted: false
			};
		},

		abort: function(){
			this.connection.aborted = true;
			this.clearSource();
		}
	};

	var http = {
		Request: HttpRequest,
		Response: HttpResponse,
		Client: HttpClient,

		createRequest: function(options){
			return new HttpRequest(options);
		},

		createResponse: function(){
			return new HttpResponse();
		},

		createClient: function(request){
			return new HttpClient(request);
		},

		createPromiseRequest: function(promiseFactory, options){
			return new Function.extend(this.FakeRequest, {
				createPromise: promiseFactory
			})(options);
		},

		createResponsePromiseFromClient: function(client){
			return new Promise(function(resolve, reject){
				if( client.state === 'closed' ){
					resolve(client.response);
				}
				else{
					client.onclose = function(){
						resolve(client.response);
					};
				}
			});
		},

		createResponsePromiseFromRequest: function(request){
			var client = this.env.http.createClient(request);
			return this.createResponsePromiseFromClient(client);
		},

		createResponsePromise: function(item){
			if( item instanceof HttpRequest ){
				return this.createResponsePromiseFromRequest(item);
			}
			else if( item instanceof HttpClient ){
				return this.createResponsePromiseFromClient(item);
			}
			else if( typeof item === 'function' ){
				return this.createResponsePromiseFromRequest(this.createPromiseRequest(item, arguments[1]));
			}
			else{
				return this.createResponsePromiseFromRequest(this.createRequest(item));
			}
		},

		setup: function(){
			this.FakeRequest = Function.extend(jsenv.require('platform-http'), FakeHttpRequest);
		}
	};

	jsenv.http = http;
	jsenv.define('http', http);

})();