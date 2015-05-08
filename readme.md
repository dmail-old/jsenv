## env

Execute & load your javascript code accross platforms

## Node example

- `npm install -g @dmail/env`
- `node env a.js`
- hello world is logged in the terminal

## Browser example

- open index.html in your browser
- hello world appear in an alert popup

Warning if you use chrome : you have to [start chrome using the flag --allow-file-access-from-files](http://www.chrome-allow-file-access-from-file.com)

## Execution context

The JavaScript is executed in a specific context, for example a file containing

```javascript
var a = include('a');

return 'hello ' + a;
```

Is equivalent to

```javascript
// ensure a is loaded before executing the module source
ENV.load('a').then(function(){
	// create a module
	var module = ENV.createModule();

	// wrap module source in a function & call it
	(function(module, include){
		var a = include('a');

		return this.hello + ' ' + a;
	}).call(ENV.global, module, module.include.bind(module));
});
```

## Source location

Javascript sources can be fetched from different locations, the followings includes are valid.

```javascript
include('foo');
include('./foo');
include('../../foo');
include('file:///C:/modules/foo');
include('http://my-domain.com/modules/foo');
include('http://external-domain.com/modules/foo');
include('https://external-domain.com/modules/foo');
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
