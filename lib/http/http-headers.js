/* globals forOf */

// https://angular.io/docs/js/latest/api/http/Headers-class.html

(function(jsenv){

	var HeadersIterator = Function.create({
		constructor: function(headers, kind){
			this.iteratedObject = headers;
			this.nextIndex = 0;
			this.iterationKind = kind || 'key+value';
			this.result = {done: false, value: undefined};
			this.iteratedKeys = Object.keys(headers.headers);
		},

		createResult: function(value, done){
			this.result.value = value;
			this.result.done = done;
			return this.result;
		},

		next: function(){
			var index = this.nextIndex, keys = this.iteratedKeys, length = keys.length, itemKind, key, object;

			if( index >= length ){
				return this.createResult(undefined, true);
			}

			this.nextIndex++;
			itemKind = this.iterationKind;
			key = keys[index];

			if( itemKind == 'key' ){
				return this.createResult(key, false);
			}

			object = this.iteratedObject;

			if( itemKind == 'value' ){
				return this.createResult(object.getAll(key), false);
			}

			return this.createResult([key, object.getAll(key)], false);
		},

		toString: function(){
			return '[object Headers Iterator]';
		}
	});

	HeadersIterator.prototype[Symbol.iterator] = function(){
		return this;
	};

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
			// todo
		},

		delete: function(name){
			checkImmutability(this);

			name = normalizeName(name);
			delete this.headers[name];
		},

		keys: function(){
			return new HeadersIterator(this, 'key');
		},

		values: function(){
			return new HeadersIterator(this, 'value');
		},

		entries: function(){
			return new HeadersIterator(this, 'key+value');
		},

		forEach: function(fn, bind){
			forOf(this.entries(), function(parts){
				var headerName = parts[0], headerValues = parts[1];

				headerValues.forEach(function(headerValue){
					fn.call(bind, headerName, headerValue);
				});
			});
		},

		toJSON: function(){
			var headers = {};

			this.forEach(function(headerName, headerValue){
				headers[headerName] = headerValue;
			});

			return headers;
		},

		toString: function(){
			var headers = [];

			forOf(this.entries(), function(headerName, headerValues){
				headers.push(headerName + ': ' + headerValues.join(', '));
			});

			return headers.join('\r\n');
		}
	});

	HttpHeaders.prototype[Symbol.iterator] = function(){
		return this.entries();
	};

	jsenv.define('http-headers', HttpHeaders);

})(jsenv);
