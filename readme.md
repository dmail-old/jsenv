Module
=============

Implement module client side

## Example

```javascript
// require a module relative to the current module
var submodule = require('../test/submodule');
// require a module
var othermodule = require('modulename');
```

## Requirements

NONE

## new Module(filename, parent)

Create a module, used internally you don't need to instantiate module by yourself.

## Module.filename

Filename leading to the module server side.

## Module.parent

Parent of this module. When a module requires an other he is considered parent of the required module.

## Module.source

Javascript source for this module. It will be evaluated when module is required.

## Module.load()

Load source with a synchronous AJAX request at module.filename

## Module.exports

What module provides is contained in Module.exports, it can be anything.

## Module.compile()

Eval source in a specific [context](#context-of-module-evaluation)

```javascript
window.ok = false;
var testModule = new Module();
testModule.source = "var ok = true; module.exports = 'yo';";
testModule.compile();

window.ok; // false
testModule.exports; // 'yo'
```

## Context of module evaluation

Module.source is evaluated as if it was written in the following anonymous function:

```javascript
(function(exports, require, module, __dirname, __filename){
	// source here
});
```

## Module.resolve(path)

Resolve path to a module filename. This is done by an asynchronous AJAX request handled by [middleware/module](../../../server/node_modules/Router/middleware/module).  
Throw Module not found error if path doesn't lead to a module.

## Module.resolvedPaths

Keep traces of resolvedPaths for this module.

## Module.require(path)

Call Module.resolve(path), create a module, loads corresponding sources, compiles it and returns module.exports.  

## Module.cache

Kepp traces of module instance by filename

## Undocumented properties

- children
- headers
- _resolve(path)
- _load()
- createChild(filename)
- eval()
