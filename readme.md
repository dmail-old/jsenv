## env

Load & execute JavaScript modules accross platforms

## Node example

- `npm install -g @dmail/env`
- `node env b`
- hello world is logged in the terminal

## Browser example

- open index.html in your browser
- hello world is logged in the console

Warning if you use chrome : you have to [start chrome using the flag --allow-file-access-from-files](http://www.chrome-allow-file-access-from-file.com)

## Module format

A module is a javaScript source executed in a specific context, for example the following :

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
		return 'hello ' + a;
	}).call(ENV.global, module, module.include.bind(module));
});
```

## Source location

Javascript sources can be fetched from different locations, for example the followings includes are valid.

```javascript
include('foo');
include('./foo');
include('../../foo');
include('file:///C:/modules/foo');
include('http://my-domain.com/modules/foo');
include('https://external-domain.com/modules/foo');
include('github://user@repo/foo');
```

## Installation

- node : `npm install -g @dmail/env`<br />
- browser : `<script src="env.js"></script>`

## ENV

This script installs a global variable called ENV

## global

The global object in the environment

- node : global
- browser : window
