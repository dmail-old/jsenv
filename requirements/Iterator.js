(function(global){
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
			this.result = {done: true, value: undefined};
			this.nextIndex = 0;
			this.iteratedKeys = Object.keys(object);
		},

		createResult: function(value, done){
			this.result = {};
			this.result.value = value;
			this.result.done = done;
			return this.result;
		},

		done: function(){
			return this.createResult(undefined, true);
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
				return this.createResult(object[key], false);
			}

			return this.createResult([key, object[key]], false);
		},

		toString: function(){
			return '[object Object]';
		}
	});
	Iterator.prototype[Symbol.Iterator] = function(){
		return this;
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
				return this.createResult(undefined, true);
			}

			this.nextIndex++;
			itemKind = this.iterationKind;

			if( itemKind == 'key' ){
				return this.createResult(index, false);
			}

			if( itemKind == 'value' ){
				return this.createResult(array[index], false);
			}

			return this.createResult([index, array[index]], false);
		},

		toString: function(){
			return '[object Array Iterator]';
		}
	});

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
				return this.createResult(undefined, true);
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

			return this.createResult(char, false);
		},

		toString: function(){
			return '[object StringIterator]';
		}
	});

	function definePrototypeProperty(constructor, property, value){
		if( false === property in constructor.prototype ){
			Object.defineProperty(constructor.prototype, Symbol.iterator, {
				enumerable: false,
				writable: true,
				value: value
			});
		}
	}

	function polyfill(constructor, iterator){
		definePrototypeProperty(constructor, Symbol.iterator, function(){
			return new Iterator(this);
		});
	}

	polyfill(Array, ArrayIterator);
	polyfill(String, StringIterator);
	definePrototypeProperty(Array, 'values', function(){
		return new ArrayIterator(this, 'value');
	});
	if( !global.Iterator ) global.Iterator = Iterator;

})(jsenv.global);