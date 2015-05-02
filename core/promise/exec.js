require('./promise');

function exec(fn, bind, args){
	return new Promise(function(resolve){
		resolve(fn.apply(bind, args));
	});
}

module.exports = exec;
Promise.exec = exec;
