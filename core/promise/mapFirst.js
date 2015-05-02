require('@dmail/iterator-map');
require('./first');

function mapFirst(iterable, map, bind, initialValue, filterReject, filterBind){
	iterable = Iterator.map(iterable, function(value, index, iterable){
		return map.bind(bind, value, index, iterable);
	}, bind);

	return Promise.first(iterable, undefined, initialValue, filterReject, filterBind);
}

module.exports = mapFirst;
Promise.mapFirst = mapFirst;