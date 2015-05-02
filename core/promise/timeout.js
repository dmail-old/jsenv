require('./promise');

function timeout(ms){
	var timer = null, promise, expire;

	promise = new Promise(function(resolve){
		expire = resolve;
	});

	promise.expire = expire;
	promise.clearTimeout = function(){
		if( timer != null ) clearTimeout(timer);
		timer = null;
	};
	promise.setTimeout = function(ms){
		promise.clearTimeout();
		timer = setTimeout(expire, ms);
	};

	promise.setTimeout(ms);

	return promise;
}

module.exports = timeout;
Promise.timeout = timeout;