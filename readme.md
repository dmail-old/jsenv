## jsenv

Load & execute JavaScript accross platforms

## Example

- `npm install -g jsenv`
- `mkdir test & cd test`
- `jsenv init`

Run with node

- `jsenv start`
- hello world is logged in the terminal

With browser

- open test/index.html
- hello world is logged in the console

>Note that when running locally, ensure you are running from a local server or a browser with local XHR requests enabled. If not you will get an error message.

>For Chrome you have to [start chrome using the flag --allow-file-access-from-files](http://www.chrome-allow-file-access-from-file.com)

>In Firefox this requires navigating to about:config, entering security.fileuri.strict_origin_policy in the filter box and toggling the option to false.

## Source location

You can include Javascript sources from different locations, the following include examples are valid.

```javascript
include('foo');
include('./foo');
include('../../foo');
include('file:///C:/modules/foo');
include('http://my-domain.com/modules/foo');
include('https://external-domain.com/modules/foo');
include('github://user@repo/foo#master');
```

## Function modules

Included JavaScript create function modules. It's javaScript code wrapped in an anonymous function, for example the following :

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

## ENV

This script installs a global variable called ENV

## global

The global object in the environment

- node : global
- browser : window
