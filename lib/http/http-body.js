(function(jsenv){

	var HttpBody = {
		bodyUsed: false,

		text: function(){
			return (this.body ? this.body.readAsString() : Promise.resolve('')).then(function(text){
				this.bodyUsed = true;
				return text;
			}.bind(this));
		},

		json: function(){
			return this.text.then(JSON.parse);
		}
	};

	jsenv.define('http-body', HttpBody);

})(jsenv);