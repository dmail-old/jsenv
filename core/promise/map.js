require('@dmail/iterator-map');
require('./promise');

// each iterable value is mapped and considered as a then() call and return an array of resolved values
function map(iterable, fn, bind){
	iterable = Iterator.map(iterable, function(value, index, iterable){
		return fn.call(bind, value, index, iterable);
	}, bind);

	return Promise.all(iterable);
}

module.exports = map;
Promise.map = map;