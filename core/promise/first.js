require('./promise');
require('@dmail/iterator');

// coule be renamed any like https://github.com/kriskowal/gtor/blob/master/task.js#L414
// but we are running the promises in serie here

// The `first` method accepts an array of promises, or value coercable to promises, and
// returns a promise that will resolve to the value of the first resolved promise
// After one resolve, all remaining promises will be ignored.
// If all promise rejects, this promise will be rejected with the last rejected value.
function first(iterable, bind, initialValue, filterReject, filterBind){
	if( !filterReject ){
		throw new TypeError('first expect a filterReject function');
	}

	var initialPromise = Promise.resolve(initialValue);

	return new Promise(function(resolve, reject){
		var iterator = iterable[Symbol.iterator](), next, fn, reason, rejected = false;

		function nextPromise(){
			next = iterator.next();

			if( next.done ){
				if( rejected ){
					reject(reason);
				}
				// can happen only if iterable is empty
				else{
					resolve();
				}
			}
			else{
				fn = next.value;
				if( typeof bind !== 'undefined' ) fn = fn.bind(bind);

				initialPromise.then(fn).then(
					resolve,
					function(value){
						if( filterReject.call(filterBind, value) ){
							rejected = true;
							reason = value;
							nextPromise();
						}
						else{
							reject(reason);
						}
					}
				);
			}
		}

		nextPromise();

	});
}

module.exports = first;
Promise.first = first;