// https://github.com/WebReflection/url-search-params/tree/master/src

(function(global){

	var replace = {
		'!': '%21',
		"'": '%27',
		'(': '%28',
		')': '%29',
		'~': '%7E',
		'%20': '+',
		'%00': '\x00'
	};

	function replacer(match){
		return replace[match];
	}

	function encode(str){
		return encodeURIComponent(str).replace(/[!'\(\)~]|%20|%00/g, replacer);
	}

	function decode(str) {
		return decodeURIComponent(str.replace(/\+/g, ' '));
	}

	var URLSearchParams = Function.create({
		constructor: function(queryString){
			this.fromString(queryString);
		},

		fromString: function(queryString){
			this.params = {};

			if( queryString ){
				var index, value, pairs = queryString.split('&'), i = 0, length = pairs.length;

				for(;i<length;i++){
					value = pairs[i];
					index = value.indexOf('=');
					if( index > -1 ){
						this.append(
							decode(value.slice(0, index)),
							decode(value.slice(index + 1))
						);
					}
				}
			}
		},

		append: function(name, value){
			var params = this.params;

			value = String(value);
			if( name in params ){
				params[name].push(value);
			}
			else{
				params[name] = [value];
			}
		},

		delete: function(name){
			delete this.params[name];
		},

		get: function(name){
			var params = this.params;
  			return name in params ? params[name][0] : null;
		},

		getAll: function(name){
			var params = this.params;
  			return name in params ? params[name].slice(0) : [];
		},

		has: function(name){
			return name in this.params;
		},

		set: function(name, value){
			value = String(value);
			this.params[name] = [value];
		},

		toJSON: function(){
			return {};
		},

		toString: function(){
			var params = this.params, query = [], key, name, i, value, j;

			for(key in params) {
				name = encode(key);
				i = 0;
				value = params[key];
				j = value.length;

				for(;i<j;i++){
					query.push(name + '=' + encode(value[i]));
				}
			}

			return query.join('&');
		}
	});

	if( false === 'URLSearchParams' in global ){
		global.URLSearchParams = URLSearchParams;
	}

})(jsenv.global);