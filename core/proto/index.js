/*

proto

provides: create, new, supplement, extend

see http://jsperf.com/objec-create-vs-new-function for perf.

Chome : new 28x faster than Object.create
Firefox: Object.create 5x faster than new

*/

if( !Object.create ){
	Object.create = (function(){
		function F(){}

		return function(object){
			if( typeof object != 'object') throw TypeError('Argument must be an object');

			F.prototype = object;
			var instance = new F();
			F.prototype = null;
			return instance;
		};
	})();
}

function defineProperty(object, name, owner){
	var descriptor = Object.getOwnPropertyDescriptor(owner, name);
	Object.defineProperty(object, name, descriptor);
}

function assignProperty(object, name, owner){
	object[name] = owner[name];
}

var addProperty = Object.defineProperty ? defineProperty : assignProperty;

function addProperties(object, owner){
	if( Object(owner) != owner ){
		throw new TypeError('owner must be an object');
	}

	var keys = Object.keys(owner), i = 0, j = keys.length;
	for(;i<j;i++){
		addProperty(object, keys[i], owner);
	}
}

var proto = {
	constructor: function(){
		// noop
	},

	extend: function(){
		var object, parent, i = 0, j = arguments.length, constructor, parentConstructor;

		if( this instanceof Function ){
			parent = this.prototype;
			object = Object.create(parent);
			addProperties(object, proto);
		}
		else{
			parent = this;
			object = Object.create(parent);
		}

		for(;i<j;i++){
			addProperties(object, arguments[i]);
		}

		// when we have a custom constructor
		if( Object.prototype.hasOwnProperty.call(object, 'constructor') ){
			constructor = object.constructor;

			if( typeof constructor != 'function' ){
				throw new TypeError('constructor must be a function');
			}
			// if the constructor is the proto constructor, create an intermediate function
			else if( constructor === proto.constructor ){
				parentConstructor = proto.constructor;
				object.constructor = constructor = function(){
					return parentConstructor.apply(this, arguments);
				};
			}
		}
		// create an intermediate function calling parentConstructor
		else{
			parentConstructor = this.constructor;
			object.constructor = constructor = function(){
				return parentConstructor.apply(this, arguments);
			};
		}

		object.super = parent;
		constructor.prototype = object;
		constructor.super = parent;

		return object;
	},

	create: function(){
		var object;

		if( this instanceof Function ){
			var length = arguments.length;

			if( length === 0 ) return new this();
			if( length === 1 ) return new this(arguments[0]);
			if( length === 2 ) return new this(arguments[0], arguments[1]);

			object = Object.create(this.prototype);
		}
		else{
			object = Object.create(this);
		}

		return object.constructor.apply(object, arguments) || object;
	}
};

Function.prototype.create = proto.create;
Function.prototype.extend = proto.extend;
Function.prototype.isPrototypeOf = function(a){
	return a instanceof this;
};

return proto;