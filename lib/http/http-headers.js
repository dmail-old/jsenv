/* globals forOf */

(function(jsenv){

	function lower(headerName){
		return String(headerName).toLowerCase();
	}

	var HttpHeaders = Function.create({
		constructor: function(headers){
			this.headers = {};

			if( headers ){
				forOf(headers, this.set, this);
			}
		},

		append: function(name, value){
			name = lower(name);
			value = String(value);

			if( name in this.headers ){
				this.headers[name].push(value);
			}
			else{
				this.headers[name] = [value];
			}
		},

		delete: function(name){
			name = lower(name);
			delete this.headers[name];
		},

		get: function(name){
			name = lower(name);
  			return name in this.headers ? this.headers[name][0] : null;
		},

		getAll: function(name){
			name = lower(name);
  			return name in this.headers ? this.headers[name].slice(0) : [];
		},

		has: function(name){
			name = lower(name);
			return name in this.headers;
		},

		set: function(name, value){
			name = lower(name);
			value = String(value);
			this.headers[name] = [value];
		},

		combine: function(name, value){
			// todo
		},

		toJSON: function(){
			return {};
		},

		toString: function(){
			// todo
		}
	});

	jsenv.define('http-headers', HttpHeaders);

})(jsenv);
