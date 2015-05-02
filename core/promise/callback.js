require('./promise');

function callback(fn, bind){
	return new Promise(function fromExecutor(resolve, reject){
		fn.call(bind, function(error, result){
			if( error ) reject(error);
			else resolve(result);
		});
	});
}

module.exports = callback;
Promise.callback = callback;