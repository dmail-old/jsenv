## env

Execute & load your javascript code accross platforms

## Example

a.js
```javascript
return 'world';
```

b.js
```javascript
var a = include('a');

return this.hello + ' ' +  a;
```

In node
````javascript
require('@dmail/env');
global.hello = 'hello';
ENV.import('b').then(console.log, console.error);
```

In a browser
```javascript
window.hello = 'hello';
ENV.import('b').then(console.log, console.error);
```

## Installation

node : `npm install -g @dmail/env`<br />
browser : `<script src="env/index.js"></script>`

## global

The global object in this environment (depends on the platform, window for browsers & global for node)

## import(name)

Locate, load, parse, execute the javascript corresponding to name, managing dependencies. Similar to System.import in es6.
