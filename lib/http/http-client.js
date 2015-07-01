(function(){

	var HttpClient = Function.create({
		retryTimeout: 100,
		redirectLimit: 10,

		lastRetry: 0,
		redirectCount: 0,
		retryUrl: null,
		isWaitingOpen: false,
		aborted: false,

		constructor: function(request){
			this.request = request;
			this.response = request.response;

			this.request.onerror = function(e){
				this.emit('error', e);
			}.bind(this);
			this.request.ontimeout = function(){
				this.emit('timeout');
			}.bind(this);
			this.request.onopen = function(){
				// only the last open
				if( this.handleResponse() ){
					this.emit('open');
				}
			}.bind(this);
			this.request.onwrite = function(data){
				this.emit('write', data);
			}.bind(this);
			this.request.onclose = function(){
				if( false === this.isWaitingOpen ){ // only the last close
					this.emit('close');
				}
			}.bind(this);
		},

		emit: function(name, e){
			if( false === this.aborted && 'on' + name in this ){
				this['on' + name](e);
			}
		},

		on: function(name, listener){
			this['on' + name] = listener;
			if( name == 'open' && this.isWaitingOpen === false && this.request.readyState === 'opened' ){
				this.emit('open');
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
			if( false === this.aborted ){
				this.request.open();
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
						return this.onerror(e);
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

	jsenv.define('http-client', HttpClient);

})();