require('@dmail/iterator');
require('./promise');

var debug = require('debug');

/*
Return a promise fullfilled on first non null resolved promise or non null rejected promise
*/

function route(iterable, bind, initialValue){
	var initialPromise = Promise.resolve(initialValue);

	return new Promise(function(resolve, reject){
		var iterator = iterable[Symbol.iterator](), next, fn, promise, rejected = false, value = null;

		function nextPromise(){
			next = iterator.next();

			if( next.done ){
				if( rejected ){
					debug('rejected route', value);
					reject(value);
				}
				else{
					// ptet qu'on va considérer que la route échoue puisque aucune route n'a match
					debug('resolved route', value);
					resolve(value);
				}
			}
			else{
				fn = next.value;

				if( rejected ){
					if( fn.length < 2 ) return nextPromise();

					debug('calling error middleware');
					promise = initialPromise.then(function(initialValue){
						return fn.call(bind, initialValue, value);
					});
				}
				else{
					if( fn.length > 1 ) return nextPromise();

					if( typeof bind !== 'undefined' ) fn = fn.bind(bind);
					debug('calling normal middleware');
					promise = initialPromise.then(fn);
				}

				promise.then(
					function(resolvedValue){
						debug('resolved middleware');
						rejected = false;
						value = resolvedValue;
						if( resolvedValue != null ) resolve(resolvedValue);
						else nextPromise();
					},
					function(reason){
						debug('rejected middleware');
						rejected = true;
						value = reason;
						nextPromise();
					}
				);
			}
		}

		nextPromise();
	});
}

module.exports = route;
Promise.route = route;