/* globals debug */

// https://developer.mozilla.org/en-US/docs/Web/API/Request

(function(){

	var DuplexStream = jsenv.require('duplex-stream');
	var Headers = jsenv.require('http-headers');
	var Body = jsenv.require('http-body');

	var HttpRequest = Function.create(Object.assign({}, Body, {
		readyState: 'closed',
		method: 'GET',
		url: null,
		headers: {},
		body: null,

		redirectMode: 'follow', // 'error', 'manual'
		redirectCount: 0,
		cacheMode: 'default', // 'no-store', 'reload', 'no-cache', 'force-cache', 'only-if-cached'
		currentUrl: null, // must be the last url of urllist

		constructor: function(options){
			if( options instanceof HttpRequest ) return options;

			options = options || {};
			if( options.headers ) options.headers = Object.assign({}, this.headers, options.headers);
			if( options.body && (this.method == 'GET' || this.method == 'HEAD') ){
				throw new TypeError('bo nody allowed for get/head requests');
			}
			Object.assign(this, options);

			this.url = new URL(this.url);
			this.headers = new Headers(this.headers);
			this.body = new DuplexStream(this.body);
			this.readyState = 'closed';
			this.currentUrl = this.url;
		},

		clone: function(){
			var cloneRequest = new this.constructor({
				method: this.method,
				url: this.url,
				headers: this.headers.toJSON(),
				body: null
			});

			if( this.body ){
				var out = this.body.tee();
				this.body = out[0];
				cloneRequest.body = out[1];
			}

			return cloneRequest;
		},

		connect: function(){
			throw new Error('unimplemented connect()');
		},

		abort: function(){
			this.readyState = 'aborted';
			this.connection.abort();
			this.rejectAbort('aborted');

			throw new Error('unimplemented abort()');
		},

		onerror: function(error){

		},

		onopen: function(){

		},

		onclose: function(){

		},

		open: function(){
			if( this.readyState == 'closed' ){
				this.readyState = 'connecting';
				// avoid browser cache, create a new url to allow request reuse
				if( this.cacheMode === 'no-cache' || this.cacheMode === 'no-store' ){
					this.url = new URL(this.url);
					this.url.searchParams.set('r', String(Math.random() + 1).slice(2));
				}

				var connection = this.connect(), promises = [], timeout = this.timeout;

				// abort promise
				promises.push(new Promise(function(resolve, reject){
					this.rejectAbort = reject;
				}.bind(this)));
				// timeout promise
				if( timeout ){
					promises.push(new Promise(function(resolve, reject){
						connection.setTimeout(timeout, function(){
							var error = new Error('server taking too long to respond');
							error.code = 'ECONNRESET';
							reject(error);
						});
					}));
				}
				// response promise
				promises.push(connection.promise);

				Promise.race(promises).then(function(response){
					if( typeof response === 'number' ) response = {status: response};
					this.opened(response.status, response.headers, response.body);
				}.bind(this)).catch(function(error){
					this.onerror(error);
				}.bind(this));

				this.connection = connection;

 				debug(this.method, String(this.url));
			}
			else{
				this.onerror(new Error('open() error : request readyState must be "closed", not "' + this.readyState + '"'));
			}
		},

		opened: function(status, headers, body){
			if( this.readyState === 'connecting' ){
				this.readyState = 'opened';
				this.onopen(status, headers, body);

				debug(status, String(this.url));

				if( body ){
					body.then(function(){
						if( this.readyState === 'opened' ){
							this.closed();
						}
					}.bind(this));
				}
				else{
					this.closed();
				}
			}
			else{
				this.onerror(new Error('opened() error : request readyState must be "connecting", not "' + this.readyState + '"'));
			}
		},

		closed: function(){
			if( this.readyState === 'opened' ){
				this.readyState = 'closed';
				this.connection = null;
				this.onclose();
			}
			else{
				this.onerror(new Error('closed() error : request readyState must be "opened", not "' + this.readyState + '"'));
			}
		},

		close: function(){
			if( this.readyState === 'opened' || this.readyState === 'connecting' ){
				this.abort();
				this.closed();
			}
		}
	}));

	HttpRequest.prototype[Symbol.species] = HttpRequest;

	jsenv.define('http-request', HttpRequest);

})();