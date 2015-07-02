(function(){

	// https://streams.spec.whatwg.org/
	var DuplexStream = Function.create({
		constructor: function(data){
			if( data instanceof DuplexStream ){
				return data;
			}

			this.buffers = [];
			this.length = 0;
			this.pipes = [];
			this.state = 'opened';

			this.promise = new Promise(function(resolve, reject){
				this.resolve = resolve;
				this.reject = reject;
			}.bind(this)).then(function(){
				this.pipes.forEach(function(pipe){
					pipe.close();
				});
			}.bind(this));

			// object data types
			if( data && typeof data === 'object' ){
				// node readable streams
				if( typeof data._read === 'function' && typeof data._readableState === 'object' ){
					data.on('error', this.error.bind(this));
					data.on('data', this.write.bind(this));
					data.on('end', this.close.bind(this));
				}
				else{
					throw new TypeError('unsupported stream data ' + data);
				}
			}
			// other data types
			else{
				if( data && typeof data === 'string' ){
					this.write(data);
				}
				this.close();
			}
		},

		pipeTo: function(stream){
			// node streams
			if( !stream.close ) stream.close = stream.end;

			if( this.state === 'closed' ){
				stream.close();
			}
			else{
				this.pipes.push(stream);
			}
		},

		write: function(data){
			this.buffers.push(data);
			this.length+= data.length;

			this.pipes.forEach(function(pipe){
				pipe.write(data);
			});
		},

		error: function(e){
			this.reject(e);
		},

		close: function(){
			this.pipes.forEach(function(pipe){
				pipe.close();
			});
			this.pipes.length = 0;
			this.state = 'closed';
			this.resolve();
		},

		then: function(a, b){
			return this.promise.then(a, b);
		},

		readAsString: function(){
			return this.promise.then(function(){
				return this.buffers.join('');
			}.bind(this));
		}
	});

	jsenv.define('duplex-stream', DuplexStream);

})();