// https://github.com/aslakhellesoy/eventsource-node/blob/master/lib/eventsource.js
// https://github.com/Yaffle/EventSource/blob/master/eventsource.js

(function(){

	var HttpEventStream = jsenv.require('http-event-stream');

	var HttpEventSource = Function.create({
		CONNECTING: 0,
		OPEN: 1,
		CLOSED: 2,
		reconnectDelay: 3000, // reconnect to server 3s after disconnection
		aliveInterval: 45000, // 45s of inactivity is considered as a closed connection
		options: {},

		constructor: function(url, options){
			this.readyState = this.CONNECTING;

			url = new URL(url);
			this.url = url;
			this.origin = url.origin;
			this.options = options || this.options;

			this.eventStream = new HttpEventStream();

			this.eventStream.on('event', this.onevent.bind(this));
	    	this.eventStream.on('retry', this.onretry.bind(this));

			this.open();
		},

		onopen: function(){
		    this.readyState = this.OPEN;

		    if( this.httpClient.hasResponseHeader('content-type') ){
				var contentType = this.httpClient.getResponseHeader('content-type');

				if( !contentType.match(/^text\/event\-stream;?(\s*charset\=utf\-8)?$/i) ){
					this.emit('error', new Error('Event source has an unsupported content-type ' + contentType));
				}
	    	}
		},

		onevent: function(e){
	    	e.origin = this.origin;
	    	this.emit(e);
		},

		onretry: function(delay){
	    	this.reconnectDelay = delay;
		},

		ondata: function(data){
			this.eventStream.write(data);
		},

		onclose: function(){
			setTimeout(this.connect.bind(this), this.reconnectDelay);
		},

		open: function(){
		    if( this.readyState !== this.CONNECTING ) return;

		    var requestOptions = Object.complete({
		    	headers: {
		    		'accept': 'text/event-stream'
		    	},
		    }, this.options);

		    var url = this.url;
		    var requestURL = new URL(url);
		    var protocol = requestURL.protocol.slice(0, 5);

		    if( protocol !== 'data:' && protocol !== 'blob:' ){
		    	if( this.lastEventId ) requestURL.searchParams.set('lastEventId', this.lastEventId);
		    	// avoid cache
		    	requestURL.searchParams.set('r', String(Math.random() + 1).slice(2));
		    }

		    requestOptions.url = requestURL;

		    this.httpRequest = jsenv.http.createRequest(requestOptions);
		    this.httpClient = jsenv.http.createClient(this.httpRequest);
		  	this.httpClient.onerror = this.onclose.bind(this);
		  	this.httpClient.onopen = this.onopen.bind(this);
		  	this.httpClient.onwrite = this.onwrite.bind(this);
		  	this.httpClient.onclose = this.onclose.bind(this);
		},

		close: function(){
			if( this.readyState === this.CLOSED ) return;

			this.readyState = this.CLOSED;
			this.httpClient.abort();
		},

		reopen: function(){
			this.close();
			this.onclose();
		}
	});

	jsenv.define('http-event-source', HttpEventSource);

})();