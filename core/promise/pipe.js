require('@dmail/iterator');
var forOf = require('@dmail/for-of');
require('./promise');

// each iterable value is considered as a then() call
function pipe(iterable, bind, initialValue){
	var promise = Promise.resolve(initialValue);

	forOf(iterable, function(fn){
		if( typeof bind !== 'undefined' ) fn = fn.bind(bind);
		promise = promise.then(fn);
	});

	return promise;
}

module.exports = pipe;
Promise.pipe = pipe;