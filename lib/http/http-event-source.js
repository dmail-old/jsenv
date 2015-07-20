// https://github.com/aslakhellesoy/eventsource-node/blob/master/lib/eventsource.js
// https://github.com/Yaffle/EventSource/blob/master/eventsource.js
// https://developer.mozilla.org/fr/docs/Web/API/EventSource
// http://www.html5rocks.com/en/tutorials/eventsource/basics/

(function(){

	var HttpEventStream = jsenv.require('http-event-stream');

	function createEventStream(){
		return new HttpEventStream();
	}

	function createRequest(options){
		return jsenv.http.createRequest(options);
	}

	function createClient(request){
		return jsenv.http.createClient(request);
	}

	// response status invalid
	function createStatusError(status){
		var error = new Error('event source connection failure, status code is ' + status);
		error.code = 'SSE_STATUS';
		return error;
	}

	// response content-type invalid
	function createContentTypeError(contentType){
		var error = new Error('Event source has an unsupported content-type ' + contentType);
		error.code = 'SSE_CONTENT_TYPE';
		return error;
	}

	// response is closed (will cause sse to reconnect)
	function createConnectionClosedError(){
		var error = new Error('connection closed by server, reconnecting...');
		error.code = 'SSE_CONNECTION_CLOSED';
		return error;
	}

	// sse is closed
	function createCloseError(){
		var error = new Error('sse closed manually');
		error.code = 'SSE_CLOSED';
		return error;
	}

	function createMethodReadyStateError(method, readyState){
		var error = new Error('sse ' + method + 'error : sse readyState is ' + readyState);
		error.code = 'SSE_METHOD_STATE';
		throw error;
	}

	function onevent(e){
		if( e.id ) this.lastEventId = e.id;
		e.origin = this.origin;
		this.dispatch(e);
	}

	function onretry(delay){
		this.reconnectDelay = delay;
	}

	function checkContentType(contentType){
		return contentType.match(/^text\/event\-stream;?(\s*charset\=utf\-8)?$/i);
	}

	function checkResponseContentType(response){
		if( response.headers.has('content-type') ){
			var contentType = response.headers.get('content-type');

			if( !checkContentType(contentType) ){
				throw createContentTypeError(contentType);
			}
		}

		return true;
	}

	function onclose(error){
		this.readyState = this.CONNECTING;
		this.dispatch({
			type: 'error',
			data: createConnectionClosedError()
		});

		setTimeout(this.open.bind(this), this.reconnectDelay);
	}

	function onerror(error){
		this.close(error);
	}

	// http://www.w3.org/TR/2011/WD-eventsource-20110208/#processing-model
	function onopen(response){
		if( response.status !== 200 ){
			throw createStatusError(response.status);
		}

		checkResponseContentType(response);

		this.readyState = this.OPEN;
		this.dispatch({
			type: 'open'
		});

		response.body.pipeTo(this.eventStream);
		// when response is closed or got an error, auto reconnect
		response.body.then(onclose.bind(this), onerror.bind(this));
	}

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
			this.listeners = {};

			url = new URL(url);

			this.url = url;
			this.origin = url.origin;
			this.options = Object.assign({}, this.options, options);

			this.eventStream = createEventStream();
			this.eventStream.on('event', onevent.bind(this));
			this.eventStream.on('retry', onretry.bind(this));

			this.open();
		},

		open: function(){
			if( this.readyState === this.OPEN ){
				throw createMethodReadyStateError('open', 'open');
			}

			var protocol = this.url.protocol.slice(0, 5);

			if( this.lastEventId && protocol !== 'data:' && protocol !== 'blob:' ){
				this.url.searchParams.set('lastEventId', this.lastEventId);
			}

			var request = createRequest({
				method: 'GET',
				url: this.url,
				headers: this.options.headers,
				cacheMode: 'no-cache'
			});

			this.readyState = this.CONNECTING;
			this.client = createClient(request);
			this.client.then(onopen.bind(this)).catch(onerror.bind(this));
			this.client.open();
		},

		close: function(error){
			if( this.readyState === this.CLOSED ){
				throw createMethodReadyStateError('close', 'closed');
			}

			this.readyState = this.CLOSED;
			this.eventStream.close();
			this.client.abort();

			error = error || createCloseError();

			this.dispatch({
				type: 'error',
				data: error
			});
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