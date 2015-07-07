(function(){

	var MessageEvent = Function.create({
		origin: null,
		lastEventId: null,
		data: null,
		target: undefined,

		constructor: function(type, options){
			this.type = type;
			Object.assign(this, options);
		}
	});

	var HttpEventStream = Function.create({
		MessageEvent: MessageEvent,

		constructor: function(){
			this.buffer = '';
			this.lastEventId = '';
			this.eventName = '';
			this.eventData = '';
			this.retry = 3000;
		},

		on: function(type, listener){
			this['on' + type] = listener;
		},

		emit: function(type, e){
			if( 'on' + type in this ){
				this['on' + type](e);
			}
		},

		createEvent: function(type, options){
			return new this.MessageEvent(type, options);
		},

		write: function(string){
			var discardTrailingNewline, buffer = this.buffer, pos, length, lineLength, fieldLength, char, i;

			discardTrailingNewline = false;
			buffer+= string;
			pos = 0;
			length = buffer.length;

			while(pos < length){
				if( discardTrailingNewline ){
					if( buffer[pos] === '\n') {
		            	pos++;
		            }
		            discardTrailingNewline = false;
				}

				lineLength = -1;
				fieldLength = -1;
				i = pos;

				while(lineLength < 0 && i < length){
					char = buffer[i];

					if( char === ':' ){
						if( fieldLength < 0 ){
							fieldLength = i - pos;
						}
					}
					else if( char === '\r' ){
						discardTrailingNewline = true;
						lineLength = i - pos;
					}
					else if( char === '\n' ){
						lineLength = i - pos;
					}

					i++;
				}

		        if( lineLength < 0 ){
		        	//console.log('break');
					break;
		        }
		        else if( lineLength === 0 ){
					//console.log('end of datas, got event : ', this.eventData);

					if( this.eventData ){
						this.emit('event', this.createEvent(this.eventName || 'message', {
							data: this.eventData.slice(0, -1), // remove trailing newline
							lastEventId: this.lastEventId
						}));
						this.eventData = '';
					}
					this.eventName = undefined;
				}
				else if( fieldLength > 0 ){
					var noValue, field, step, fieldStart, valueLength, value;

					noValue = fieldLength < 0;
					field = buffer.slice(pos, pos + (noValue ? lineLength : fieldLength));
					if( noValue ){
						step = lineLength;
					}
					else if( buffer[pos + fieldLength + 1] !== ' ' ){
						step = fieldLength + 1;
					}
					else{
						step = fieldLength + 2;
					}
					fieldStart = pos + step;
					valueLength = lineLength - step;
					value = buffer.slice(fieldStart, fieldStart + valueLength);

					//console.log('got a field : ', field);

					if( field === 'data' ){
						this.eventData+= value + '\n';
					}
					else if( field === 'event' ){
						this.eventName = value;
					}
					else if( field === 'id' ){
						this.lastEventId = value;
					}
					else if( field === 'retry' ){
						var retry = parseInt(value, 10);
						if( !Number.isNaN(retry) ){
							this.retry = retry;
							this.emit('retry', retry);
						}
					}
				}

		        pos+= lineLength + 1;
		        //console.log('move cursor to', pos, 'length is', length);
		   	}

		    if( pos === length ){
		        //console.log('empty the buffer');
		        buffer = '';
		    }
		    else if( pos > 0 ){
		        //console.log('slice the buffer at', pos);
		        buffer = buffer.slice(pos);
		    }

		    this.buffer = buffer;
		},

		close: function(){

		}
	});

	jsenv.define('http-event-stream', HttpEventStream);

})();