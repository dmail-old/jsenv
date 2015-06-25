// https://github.com/aslakhellesoy/eventsource-node/blob/master/lib/eventsource.js
// https://github.com/Yaffle/EventSource/blob/master/eventsource.js

(function(){

	var HttpEventStream = jsenv.require('http-event-stream');

	var HttpEventSource = Function.create({
		EventStream: HttpEventStream,
		CONNECTING: 0,
		OPEN: 1,
		CLOSED: 2,
		reconnectDelay: 3000, // reconnect to server 3s after disconnection
		aliveInterval: 45000, // 45s of inactivity is considered as a closed connection
		options: {
			headers: {
				'accept': 'text/event-stream'
			}
		},

		constructor: function(url, options){
			this.readyState = this.CONNECTING;
			this.listeners = {};

			url = new URL(url);

			this.url = url;
			this.origin = url.origin;
			this.options = Object.assign({}, this.options, options);

			this.eventStream = this.createEventStream();
		    this.request = this.createRequest({method: 'GET', url: this.url, headers: this.options.headers});
		    this.client = this.createClient(this.request);

		    this.eventStream.on('event', this.onevent.bind(this));
			this.eventStream.on('retry', this.onretry.bind(this));
		  	this.client.on('error', this.onclose.bind(this));
		  	this.client.on('open', this.onopen.bind(this));
		  	this.client.on('write', this.onwrite.bind(this));
		  	this.client.on('close', this.onclose.bind(this));

			this.open();
		},

		createEventStream: function(){
			return new this.EventStream();
		},

		createRequest: function(options){
			return jsenv.http.createRequest(options);
		},

		createClient: function(request){
			return jsenv.http.createClient(request);
		},

		onevent: function(e){
			e.origin = this.origin;
			this.emit(e);
		},

		onretry: function(delay){
			this.reconnectDelay = delay;
		},

		onopen: function(){
		    this.readyState = this.OPEN;

		    if( this.client.hasResponseHeader('content-type') ){
				var contentType = this.client.getResponseHeader('content-type');

				if( !contentType.match(/^text\/event\-stream;?(\s*charset\=utf\-8)?$/i) ){
					this.emit('error', new Error('Event source has an unsupported content-type ' + contentType));
				}
	    	}

	    	this.client.response.body.pipeTo(this.eventStream);
		},

		onwrite: function(data){
			this.eventStream.write(data);
		},

		onclose: function(){
			setTimeout(this.open.bind(this), this.reconnectDelay);
		},

		open: function(){
		    if( this.readyState !== this.CONNECTING ) return;

		    var protocol = this.url.protocol.slice(0, 5);
		    var requestURL = new URL(this.url);

		    if( protocol !== 'data:' && protocol !== 'blob:' ){
		    	if( this.lastEventId ) requestURL.searchParams.set('lastEventId', this.lastEventId);
		    	// avoid cache
		    	requestURL.searchParams.set('r', String(Math.random() + 1).slice(2));
		    }

		    this.request.url = requestURL;
		    this.client.open();
		},

		close: function(){
			if( this.readyState === this.CLOSED ) return;

			this.readyState = this.CLOSED;
			this.client.abort();
		},

		reopen: function(){
			this.close();
			this.onclose();
		},

		emit: function(e){
			if( name in this.listeners ){
				this.listeners[name](e);
			}
		},

		on: function(name, listener){
			this.listeners[name] = listener;
		}
	});

	jsenv.define('http-event-source', HttpEventSource);

})();