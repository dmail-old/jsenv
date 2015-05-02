# proto

Manipulate object instead of constructor

## Example

```javascript
var proto = require('@dmail/proto');

var User = proto.extend({
	name: null,

	constructor: function(name){
		this.name = name;
	},

	get firstLetter(){
		return this.name[0];
	}
});

// create a user
var user = User.create('foo');

Object.getPrototypeOf(user); // User
User.isPrototypeOf(user); // true
user.firstLetter; // 'f'

var Admin = User.extend({
	type: 'admin'
});

// create an admin
var admin = Admin.create('bar');

Object.getPrototypeOf(admin); // Admin
User.isPrototypeOf(admin); // true
admin.firstLetter; // 'b'
```

## How to manipulate the object returned by proto.extend()

```javascript
var Item = proto.extend();

// item is meant to be used as prototype for other objects
// you can create item object, it's the equivalent of new
var item = Item.create();

// because sometimes it's usefull to use the constructor style you can do the following
var Item = proto.extend();
Item = Item.constructor;
var item = new Item();
```

## Extend constructor

```javascript
function User(){};
var Admin = proto.extend.call(User); // or User.extend() because Function.prototype.extend = proto.extend
```

## Create constructor

```javascript
function User(){};
var user = proto.create.call(User); // or User.create() because Function.prototype.create = proto.create
```

## Calling a parent method

```javascript
var User = proto.extend({
	foo: function(){
		console.log('foo');
	}
});
var Admin = User.extend({
	foo: function(){
		Admin.super.foo.call(this); // or User.foo.call(this);
	}
});
```

## Custom instantiation logic

Like a traditionnal constructor you can do the following

```javascript
var Parser = proto.extend({
	cache: {},
	expression: null,

	hasCache: function(expression){
		return expression in this.cache;
	},

	constructor: function(expression){
		// returns an existing cached instance
		if( this.hasCache(expression) ){
			return this.cache[expression];
		}
		this.cache[expression] = this;
		this.expression = expression;
	}
});

var parser_a = Parser.create('hello');
var parser_b = Parser.create('hello');
var parser_c = Parser.create('world');

parser_a == parser_b; // true
parser_a == parser_c; // false
Parser.cache['hello'] == parser_a; // true
Parser.cache['world'] == parser_c; // true
```

## Browser compatibility

All browsers are supported but stuff* related to custom properties depends on [Object.defineProperty compat](http://kangax.github.io/es5-compat-table/#Object.defineProperty) :
 - Firefox 5+
 - Chrome 4+
 - Internet Explorer 9+
 - Opera 11.6+
 - Safari 5.1+

(*) In an environment without Object.defineProperty basic stuff works but the following cannot be used (get firstLetter(), Object.defineProperty, Object.getOwnPropertyDescriptor, ...)
