## env

Execute & load your javascript code accross platforms

## Node example

- `npm install -g @dmail/env`
- `node env a.js`
- `hello world` is logged in your terminal

## Browser example

- open index.html in your browser (double click)
- `hello world` appear in an alert popup

Warning if you use chrome : you have to [start chrome using the flag --allow-file-access-from-files](http://www.chrome-allow-file-access-from-file.com)

## Module format

Env will read your code to create modules, for example check [b.js](./b.js).

`b.js`
```javascript
var a = include('a');

return 'hello ' + a;
```

Is equivalent to

```javascript
// ensure a is loaded before executing b
ENV.load('a').then(function(){
	// create a module called b
	var module = ENV.createModule('b');

	// wrap module source in a function & call the function with this set to ENV.global
	(function(module, include){
		var a = include('a');

		return this.hello + ' ' + a;
	}).call(ENV.global, module, module.include.bind(module));
});
```

## Installation

- node : `npm install -g @dmail/env`<br />
- browser : `<script src="env/index.js"></script>`

## ENV

This script installs a global variable called ENV

## global

The global object in the environment

- node : global
- browser : window

## include(name)

Example of valid module names :

- 'foo'
- './foo'
- '../../foo'
- 'file://folder/modules/foo',
- 'http://my-domain.com/modules/foo'
- 'http://external-domain.com/modules/foo'
- 'https://external-domain.com/modules/foo'

## import(name)

Locate, load, parse, execute the javascript corresponding to name, managing dependencies.  
Similar to es6 System.import.