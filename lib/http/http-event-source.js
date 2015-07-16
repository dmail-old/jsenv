// https://github.com/aslakhellesoy/eventsource-node/blob/master/lib/eventsource.js
// https://github.com/Yaffle/EventSource/blob/master/eventsource.js
// https://developer.mozilla.org/fr/docs/Web/API/EventSource
// http://www.html5rocks.com/en/tutorials/eventsource/basics/

(function(){

	var HttpEventStream = jsenv.require('http-event-stream');

	var HttpEventSource = Function.create({
		EventStream: HttpEventStream,
		CONNECTING: 0,
		OPEN: 1,
		CLOSED: 2,
		reconnectDelay: 3000, // reconnect to server 3s after disconnection
		aliveInterval: 45000, // 45s of inactivity is considered as a closed connection
		lastEventId: '',
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
			this.eventStream.on('event', this.onevent.bind(this));
			this.eventStream.on('retry', this.onretry.bind(this));

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
			if( e.id ) this.lastEventId = e.id;
			e.origin = this.origin;
			this.dispatch(e);
		},

		onretry: function(delay){
			this.reconnectDelay = delay;
		},

		open: function(){
			if( this.readyState !== this.CONNECTING ) return;

			var protocol = this.url.protocol.slice(0, 5);

			if( this.lastEventId && protocol !== 'data:' && protocol !== 'blob:' ){
				this.url.searchParams.set('lastEventId', this.lastEventId);
			}

			var request = this.createRequest({
				method: 'GET',
				url: this.url,
				headers: this.options.headers,
				cacheMode: 'no-cache'
			});

			this.client = this.createClient(request);

			this.client.then(function(response){
				this.readyState = this.OPEN;

				if( response.status === 204 ) return;
				if( response.status !== 200 ){
					throw new Error('event source connection failure, status code is ' + response.status);
				}

				if( response.headers.has('content-type') ){
					var contentType = response.headers.get('content-type');

					if( !contentType.match(/^text\/event\-stream;?(\s*charset\=utf\-8)?$/i) ){
						var errorEvent = {
							type: 'error',
							data: new Error('Event source has an unsupported content-type ' + contentType)
						};

						throw errorEvent;
					}
				}


				response.body.pipeTo(this.eventStream);
				// when response is closed or got an error, auto reconnect
				response.body.then(this.reopen.bind(this), this.reopen.bind(this));

				this.dispatch({
					type: 'open'
				});

			}.bind(this)).catch(function(error){

				this.close();
				this.dispatch({
					type: 'error',
					data: error
				});

			}.bind(this));

			this.client.open();
		},

		reconnect: function(){
			setTimeout(this.open.bind(this), this.reconnectDelay);
		},

		close: function(){
			if( this.readyState === this.CLOSED ) return;

			this.readyState = this.CLOSED;
			this.eventStream.close();
			//this.client.abort();
		},

		reopen: function(){
			this.close();
			this.reconnect();
		},

		dispatch: function(e){
			if( e.type in this.listeners ){
				this.listeners[e.type](e);
			}
		},

		on: function(name, listener){
			this.listeners[name] = listener;
		}
	});

	jsenv.define('http-event-source', HttpEventSource);

})();