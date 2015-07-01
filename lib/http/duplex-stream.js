(function(){

	var DuplexStream = Function.create({
		constructor: function(){
			this.buffers = [];
			this.length = 0;
			this.pipes = [];

			this.promise = new Promise(function(resolve, reject){
				this.resolve = resolve;
				this.reject = reject;
			}.bind(this)).then(function(){
				this.pipes.forEach(function(pipe){
					pipe.close();
				});
			}.bind(this));
		},

		pipeTo: function(stream){
			if( !stream.close ) stream.close = stream.end; // node streams
			this.pipes.push(stream);
		},

		unpipeTo: function(stream){
			this.pipes.splice(this.pipes.indexOf(stream), 1);
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
			this.resolve();
		},

		then: function(a, b){
			return this.promise.then(a, b);
		},

		readAsString: function(){
			return this.promise.then(function(){
				return this.buffers.join('');
			}.bind(this));
		},

		// helper
		pipeFrom: function(readableStream){
			if( false === readableStream instanceof DuplexStream ){ // node streams
				var self = this;
				var listeners = {
					error: function(e){ self.error(e); },
					data: function(data){ self.write(data); },
					end: function(){ self.close(); }
				};

				readableStream.pipeTo = function(writableStream){
					for(var key in listeners ){
						readableStream.addListener(key, listeners[key]);
					}
				};

				readableStream.unpipeTo = function(){
					for(var key in listeners ){
						readableStream.removeListener(key, listeners[key]);
					}
				};
			}

			readableStream.pipeTo(this);
		}
	});

	jsenv.define('duplex-stream', DuplexStream);

})();