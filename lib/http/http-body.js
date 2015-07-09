(function(jsenv){

	var HttpBody = {
		text: function(){
			return this.body ? this.body.readAsString() : Promise.resolve('');
		},

		json: function(){
			return this.text.then(JSON.parse);
		}
	};

	jsenv.define('http-body', HttpBody);

})();