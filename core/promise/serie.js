require('./promise');
require('@dmail/iterator');
var forOf = require('@dmail/for-of');

// same as reduce but collect the resolved values and return them
function serie(iterable, bind, initialValue){
	var promise = Promise.resolve(initialValue), values = [];

	forOf(iterable, function(fn){
		if( typeof bind !== 'undefined' ) fn = fn.bind(bind);
		promise = promise.then(fn);
		promise.then(
			function(value){
				values.push(value);
				return value;
			},
			// we add an empty function to listen for promise rejection
			// else the promise rejection is considered unhandled
			function(){}
		);
	});

	return promise.then(function(){
		return values;
	});
}

module.exports = serie;
Promise.serie = serie;