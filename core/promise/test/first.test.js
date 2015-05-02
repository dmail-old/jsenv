exports['Promise.first'] = function(test){
	function start(array){
		return Promise.first(array, null, null, function(){
			return true;
		});
	}

	test.resolveTo(start([
		function(){
			return Promise.reject('first');
		},
		function(){
			return Promise.reject('last');
		}
	]).catch(function(reason){ return reason; }), 'last');

	test.resolveTo(start([
		function(){
			return Promise.reject();
		},
		function(){
			return Promise.resolve('ok');
		}
	]), 'ok');

	test.resolveTo(start([
		function(){
			return Promise.resolve('first');
		},
		function(){
			return Promise.resolve('last');
		}
	]), 'first');
};