(function(global){
	var generate = jsenv.es6.iterator.generate;
	var done = jsenv.es6.iterator.done;
	var polyfill = jsenv.es6.iterator.polyfill;

	var Iterator = Function.create({
		constructor: function(object, keyOnly){
			if( arguments.length === 0 ){
				throw new TypeError('missing argument 0 when calling function Iterator');
			}
			if( object == null ){
				throw new TypeError('can\'t convert null to object');
			}
			if( !(this instanceof Iterator) ){
				return new Iterator(object, keyOnly);
			}

			object = Object(object); // will convert "a" into new String("a") for instance

			this.iteratedObject = object;
			this.iterationKind = typeof keyOnly === 'string' ? keyOnly : keyOnly ? 'key' : 'key+value';
			this.nextIndex = 0;
			this.iteratedKeys = Object.keys(object);
		},

		next: function(){
			var index = this.nextIndex, keys = this.iteratedKeys, length = keys.length, itemKind, key, object;

			if( index >= length ){
				throw new Error();
			}

			this.nextIndex++;
			itemKind = this.iterationKind;
			key = keys[index];

			if( itemKind == 'key' ){
				return key;
			}

			object = this.iteratedObject;

			if( itemKind == 'value' ){
				return object[key];
			}

			return [key, object[key]];
		},

		toString: function(){
			return '[object Object]';
		}
	});

	// in firefox the following line of code
	// var o = {foo: 'bar'}; var it = Iterator(o); var ita = it[Symbol.iterator](); var itb = it[Symbol.iterator](); ita.next(); itb.next();
	// results in done = true, it means the iterator used is the same
	Iterator.prototype[Symbol.Iterator] = function(){
		var self = this;

		return {
			next: function(){
				var value;

				try{
					value = generate(self.next());
				}
				catch(e){
					value = done();
				}

				return value;
			}
		};
	};

	// see http://people.mozilla.org/~jorendorff/es6-draft.html#sec-array-iterator-objects
	var ArrayIterator = Function.extend(Iterator, {
		constructor: function(array, kind){
			if( !(array instanceof Array) ){
				throw new TypeError('array expected');
			}

			this.iteratedObject = array;
			this.nextIndex = 0;
			this.iterationKind = kind || 'value';
			this.result = {done: false, value: undefined};
		},

		next: function(){
			var index = this.nextIndex, array = this.iteratedObject, length = array.length, itemKind;

			if( index >= length ){
				return done();
			}

			this.nextIndex++;
			itemKind = this.iterationKind;

			if( itemKind == 'key' ){
				return generate(index);
			}

			if( itemKind == 'value' ){
				return generate(array[index]);
			}

			return generate([index, array[index]]);
		},

		toString: function(){
			return '[object Array Iterator]';
		}
	});
	ArrayIterator.prototype[Symbol.iterator] = function(){
		return this;
	};

	// see http://people.mozilla.org/~jorendorff/es6-draft.html#sec-%stringiteratorprototype%.next
	var StringIterator = Function.extend(Iterator, {
		iteratedString: null,
		nextIndex: null,
		result: null,

		constructor: function(string){
			if( typeof string != 'string' ){
				throw new TypeError('string expected');
			}

			this.iteratedString = string;
			this.nextIndex = 0;
			this.result = {done: false, value: undefined};
		},

		next: function(){
			var string = this.iteratedString;
			var position = this.nextIndex;
			var length = string.length;
			var result = this.result;

			if( position >= length ){
				this.string = null;
				return done();
			}

			var char = string[position];
			var first = char.charCodeAt(0);

			if( first >= 0xD800 && first <= 0xDBFF && position < length ){
				this.nextIndex+=2;
				char = first + string[position + 1];
			}
			else{
				this.nextIndex++;
			}

			return generate(char);
		},

		toString: function(){
			return '[object StringIterator]';
		}
	});
	StringIterator.prototype[Symbol.iterator] = function(){
		return this;
	};

	polyfill(String, StringIterator);
	polyfill(Array, ArrayIterator, true);
	if( !global.Iterator ) global.Iterator = Iterator;

})(jsenv.global);