require('symbol');
var proto = require('proto');

function isIterable(object){
	return Object(object) == object ? typeof object[Symbol.iterator] === 'function' : false;
}

var Iterator = {
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
		this.iterationKind = keyOnly ? 'key' : 'key+value';
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
		key = this.keys[index];

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
};
Iterator[Symbol.Iterator] = function(){
	return this;
};
Iterator.constructor.prototype = Iterator;
Iterator = Iterator.constructor;

// see http://people.mozilla.org/~jorendorff/es6-draft.html#sec-array-iterator-objects
var ArrayIterator = proto.extend.call(Iterator, {
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
ArrayIterator = ArrayIterator.constructor;

// see http://people.mozilla.org/~jorendorff/es6-draft.html#sec-%stringiteratorprototype%.next
var StringIterator = proto.extend.call(Iterator, {
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
StringIterator = StringIterator.constructor;

if( !(Iterator in this) ){
	this.Iterator = Iterator;
}
function polyfill(constructor, iterator){
	if( !(Symbol.iterator in constructor.prototype) ){
		Object.defineProperty(constructor.prototype, Symbol.iterator, {
			enumerable: false,
			writable: true,
			value: function(){
				return new iterator(this);
			}
		});
	}
}

polyfill(String, StringIterator);
polyfill(Array, ArrayIterator);

return {
	isIterable: isIterable,
	Iterator: Iterator,
	ArrayIterator: ArrayIterator,
	StringIterator: StringIterator	
};