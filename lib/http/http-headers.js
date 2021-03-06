/* globals forOf */

/*
https://developer.mozilla.org/en-US/docs/Web/API/Headers
https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
*/

(function(jsenv){

	function normalizeName(headerName){
		headerName = String(headerName);
		if( /[^a-z0-9\-#$%&'*+.\^_`|~]/i.test(headerName) ){
			throw new TypeError('Invalid character in header field name');
		}

		return headerName.toLowerCase();
	}

	function normalizeValue(headerValue){
		return String(headerValue);
	}

	// https://gist.github.com/mmazer/5404301
	function parseHeaders(headerString){
		var headers = {}, pairs, pair, index, i, j, key, value;

		if( headerString ){
			pairs = headerString.split('\r\n');
			i = 0;
			j = pairs.length;
			for(;i<j;i++){
				pair = pairs[i];
				index = pair.indexOf(': ');
				if( index > 0 ){
					key = pair.slice(0, index);
					value = pair.slice(index + 2);
					headers[key] = value;
				}
			}
		}

		return headers;
	}

	function checkImmutability(headers){
		if( headers.guard === 'immutable' ){
			throw new TypeError('headers are immutable');
		}
	}

	var HttpHeaders = Function.create({
		guard: 'none', // immutable

		constructor: function(headers){
			this.headers = {};

			if( headers ){
				if( typeof headers === 'string' ){
					headers = parseHeaders(headers);
				}

				if( headers instanceof HttpHeaders ){
					headers.forEach(this.append, this);
				}
				else if( Symbol.iterator in headers ){
					jsenv.forOf(headers, function(parts){
						this.append(parts[0], parts[1]);
					}, this);
				}
				else if( typeof headers === 'object' ){
					for(var name in headers){
						this.append(name, headers[name]);
					}
				}
			}
		},

		has: function(name){
			name = normalizeName(name);
			return name in this.headers;
		},

		get: function(name){
			name = normalizeName(name);
  			return name in this.headers ? this.headers[name][0] : null;
		},

		getAll: function(name){
			name = normalizeName(name);
  			return name in this.headers ? this.headers[name] : [];
		},

		set: function(name, value){
			checkImmutability(this);

			name = normalizeName(name);
			value = normalizeValue(value);
			this.headers[name] = [value];
		},

		append: function(name, value){
			checkImmutability(this);

			name = normalizeName(name);
			value = normalizeValue(value);

			if( name in this.headers ){
				this.headers[name].push(value);
			}
			else{
				this.headers[name] = [value];
			}
		},

		combine: function(name, value){
			checkImmutability(this);

			name = normalizeName(name);
			value = normalizeValue(value);

			if( name in this.headers ){
				this.headers[name][0]+= ', ' + value;
			}
			else{
				this.headers[name] = [value];
			}
		},

		delete: function(name){
			checkImmutability(this);

			name = normalizeName(name);
			delete this.headers[name];
		},

		forEach: function(fn, bind){
			forOf(this, function(parts){
				var headerName = parts[0], headerValues = parts[1];

				headerValues.forEach(function(headerValue){
					fn.call(bind, headerName, headerValue);
				});
			});
		},

		toJSON: function(){
			return this.headers;
		},

		toString: function(){
			var headers = [];

			forOf(this.entries(), function(headerName, headerValues){
				headers.push(headerName + ': ' + headerValues.join());
			});

			return headers.join('\r\n');
		}
	});

	jsenv.es6.iterator.implement(HttpHeaders, 'headers', true);
	jsenv.define('http-headers', HttpHeaders);

})(jsenv);
