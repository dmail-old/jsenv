require('@dmail/iterator-map');
require('./serie');

// each iterable value is mapped and considered as a then() call and return an array of resolved values
function mapSerie(iterable, fn, bind, initialValue){
	iterable = Iterator.map(iterable, function(value, index, iterable){
		return fn.bind(bind, value, index, iterable);
	}, bind);

	return Promise.serie(iterable, null, initialValue);
}

module.exports = mapSerie;
Promise.mapSerie = mapSerie;