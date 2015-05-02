exports['promise resolving to rejected promise'] = function(test){
	var promise = new Promise(function(resolve){
		var taskPromise = Promise.resolve(); //Promise.reduce([]);

		taskPromise = taskPromise.then(function(){
			throw new Error('foo');
		});

		resolve(taskPromise);
	});

	test.resolveTo(promise.catch(function(error){ return error.message; }), 'foo');
};

exports['thenable called on resolve but not on reject'] = function(test){
	var resolvedPromise = Promise.resolve('ok');

	test.willResolve(Promise.resolve(resolvedPromise).then(function(value){
		test.equal(value, 'ok');
	}));
	test.willResolve(Promise.reject(resolvedPromise).catch(function(value){
		test.equal(value, resolvedPromise);
	}));
};

exports['unhandled rejection emitted'] = function(test, Promise){
	var promise = new Promise(function(resolve, reject){
		process.once('unhandledRejection', function(value, promise){
			resolve(value);
		});
	});

	var rejectValue = {};
	Promise.reject(rejectValue);

	test.resolveTo(promise, rejectValue);
};

exports['unhandled rejection emitted when resolved to a rejected promise'] = function(test, Promise){
	var promise = new Promise(function(resolve, reject){
		process.once('unhandledRejection', function(value, promise){
			resolve(value);
		});
	});

	var rejectValue = {};
	Promise.resolve(new Promise(function(resolve, reject){
		setTimeout(function(){
			reject(rejectValue);
		}, 4);
	}));

	test.resolveTo(promise, rejectValue);
};

exports['native Promise'] = function(test){
	if( global.Promise.polyfill !== true ){
		console.log('skip test');
		return test.skip();
	}

	var Promise = global.Promise;

	test.willResolve(Promise.reject('rejected').catch(function(){
		return 'resolved';
	}));
};

exports['promise must be polyfilled once'] = function(test, Promise){
	var oldPromise = global.Promise;

	var id = require.resolve('promise');
	delete require.cache[id];
	require(id);

	test.equal(oldPromise, global.Promise);
};