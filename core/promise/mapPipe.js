require('@dmail/iterator-map');
require('./pipe');

// same as map but values are not collected
function mapPipe(iterable, fn, bind, initialValue){
	iterable = Iterator.map(iterable, function(value, index, iterable){
		return fn.bind(bind, value, index, iterable);
	}, bind);

	return Promise.pipe(iterable, undefined, initialValue);
}

module.exports = mapPipe;
Promise.mapPipe = mapPipe;