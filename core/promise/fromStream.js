require('./promise');

function fromStream(stream){
	return new Promise(function(resolve, reject){
		var buffers = [], length = 0;

		stream.on('error', function(error){
			reject(error);
		});

		stream.on('data', function(buffer){
			buffers.push(buffer);
			length+= buffer.length;
		});
		stream.on('end', function(){
			resolve(Buffer.concat(buffers, length));
		});

		if( stream.isPaused() ) stream.resume();
	});
}

module.exports = fromStream;
Promise.fromStream = fromStream;