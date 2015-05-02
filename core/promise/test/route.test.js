exports['Promise.route routing errors'] = function(test){
	test.resolveTo(Promise.route([
		function(){
			throw new Error('foo');
		},
		function(handler, error){
			return error.message + 'bar';
		}
	]), 'foobar');

	test.resolveTo(Promise.route([
		function(){
			return Promise.reject('foo');
		},
		function(handler, error){
			throw 'error';
		},
		function(handler, error){
			return 'foo';
		}
	]), 'foo');
};

exports['Promise.route routing'] = function(test){
	var middlewares = [
		function(value){
			if( value == 'a' ) return Promise.resolve('foo');
		},
		function(value){
			if( value == 'b' ) return Promise.resolve('bar');
		}
	];

	test.resolveTo(Promise.route(middlewares, null, 'a'), 'foo');
	test.resolveTo(Promise.route(middlewares, null, 'b'), 'bar');
};