var Ajax = {
	headers: {},
	cache: [],
	onResolve: null,
	onReject: null,

	constructor: function(options){
		this.url = options.url;
		this.headers = options.headers;
		this.method = options.method;
		this.sync = options.sync;
		this.body = options.body;
		this.send();
	},

	then: function(onResolve, onReject){
		this.onResolve = onResolve;
		this.onReject = onReject;
	},

	// https://gist.github.com/mmazer/5404301
	parseHeaders: function(headerString){
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
	},

	complete: function(){
		if( this.status >= 200 || this.status < 400 ){
			this.onResolve(this.responseText);
		}
		else{
			this.onReject();
		}
	},

	fromXhr: function(){
		this.status = this.xhr.status;
		this.responseText = this.xhr.responseText;
		this.responseHeaders = this.parseHeaders(this.xhr.getAllResponseHeaders());
		this.complete();
	},

	isCached: function(request){
		if( this.url != request.url ) return false;
		if( this.method != request.method ) return false;
		//if( this.headers != request.headers ) return false;
		return true;
	},

	fromCache: function(){
		var cache = this.cache, i = 0, j = cache.length, entry;

		for(;i<j;i++){
			entry = cache[i];
			if( this.isCached(entry.request) ){
				this.status = entry.response.statusCode;
				this.responseText = entry.response.body;
				this.responseHeaders = entry.response.headers;
				this.complete();
				return true;
			}
		}

		return false;
	},

	send: function(){
		if( this.fromCache() ){

		}
		else{
			this.xhr = new XMLHttpRequest();
			this.xhr.open(this.method, this.url, this.sync);
			for(var header in this.headers ){
				this.xhr.setRequestHeader(header, this.headers);
			}
			this.xhr.send(this.body);

			if( this.sync ){
				this.fromXhr();
			}
			else{
				this.xhr.onreadystatechange = function(){
					if( this.xhr.readyState == 4 ){
						this.fromXhr();
					}
				}.bind(this);
			}
		}
	}
};

Ajax.constructor.prototype = Ajax;
Ajax = Ajax.constructor;

module.exports = Ajax;