require('@dmail/iterator');
var forOf = require('@dmail/for-of');

var Promise = require('./core');
var isThenable = require('./is-thenable');
var callThenable = require('./call-thenable');

// que fait-on lorsque value est thenable?
Promise.resolve = function(value){
	return new this(function resolveExecutor(resolve){
		resolve(value);
	});
};

Promise.reject = function(value){
	return new this(function rejectExecutor(resolve, reject){
		reject(value);
	});
};

Promise.all = function(iterable){
	return new this(function allExecutor(resolve, reject){
		function res(value, index){
			if( isThenable(value) ){
				callThenable(value, function(value){ res(value, index); }, reject);
			}
			else{
				values[index] = value;
				length--;
				if( length === 0 ) resolve(values);
			}
		}

		var index = 0, length = 0, values = [];

		forOf(iterable, function(value){
			length++;
			res(value, index);
			index++;
		});

		if( length === 0 ) resolve(values);
	});
};

Promise.race = function(iterable){
	return new this(function(resolve, reject){
		forOf(iterable, function(thenable){
			thenable.then(resolve, reject);
		});
	});
};

module.exports = Promise;