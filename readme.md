## env

Provide an API to manage your javascript code accross platforms

## Example

`a.js`
```javascript
return 'world';
```

`b.js`
```javascript
var a = include('a');

return this.hello + ' ' +  a;
```

In a node javascript file
````javascript
require('@dmail/env');
global.hello = 'hello';
ENV.import('b').then(console.log, console.error);
```

In a browser script tag
```javascript
window.hello = 'hello';
ENV.import('b').then(console.log, console.error);
```

## Installation

With node do `npm install -g @dmail/env`
In the browser insert ````HTML<script src="env/index.js"></script>``` in your head tag

## Supported platforms

Currently there is two supported platforms called 'node' & 'browser'

## global

The global object in this environment (depends on the platform, window for browsers & global for node)

## import(name)

Locate, load, parse, execute the javascript corresponding to name, managing dependencies. Similar to System.import in es6.