/* globals Request */

/*
inspiration:
https://github.com/joyent/node/blob/master/lib/module.js
https://github.com/joyent/node/blob/master/src/node.js
http://fredkschott.com/post/2014/06/require-and-the-module-system/?utm_source=nodeweekly&utm_medium=email

System.requestFile could use exactly the same API
and check if status is 404
for local urls, it's our own server who is responding (99% of the time I suppose)

pour browser les url interne pourraient essayer de trouver le fichier sur le filesystem
puis essayer de les récup via une requête

'file:./module.js' -> node, cherche sur le filesystem, browser cherche sur le filesystem sinon fallback sur xhr
'http://module.js' -> node et browser, passe par une requête

check url resolution at https://github.com/ModuleLoader/es6-module-loader/blob/master/src/system.js

*/

var moduleScanner = require('./module-scanner');

function shortenPath(filepath){
	return require('path').relative(System.baseUrl, filepath);
}

function debug(){
	var args = Array.prototype.slice.call(arguments);

	args = args.map(function(arg){
		if( arg instanceof Module ){
			arg = shortenPath(arg.filename);
		}
		else if( String(arg).match(/\\|\//) ){
			arg = shortenPath(arg);
		}
		return arg;
	});

	console.log.apply(console, args);
}

var System = {
	platform: 'unknown',
	global: null,
	baseUrl: null,
	extension: '.js',
	paths: {},
	dependencies: [
		'symbol', // because required by iterator
		'iterator', // because required by promise
		'promise', // because it's amazing
		// 'request', // pour browser c'est xmlhttprequest, pour node c'est un module qui fait une requête 
		// puisque le module peut très bien dire require('http://google.fr/api.js') 
		// ou alors require('./') mais ce sera résolu par le filesystem
		// https://github.com/kriszyp/nodules/blob/master/lib/nodules-utils/node-http-client.js
	],

	resolveUrl: function(){
		throw new Error('unimplemented resolveUrl()');
	},

	fetchTextFromURL: function(){
		throw new Error('unimplemented fetchTextFromURL()');
	},

	fetchTextFromFile: function(){
		throw new Error('unimplemented fetchTextFromFile()');
	},

	eval: function(){
		throw new Error('unimplemented eval()');
	},

	createModuleNotFoundError: function(filename){
		var error = new Error('no module named' + filename + ' can be found');
		error.code = 'MODULE_NOT_FOUND';
		return error;
	},

	forceExtension: function(pathname, extension){
		if( pathname.slice(-(extension.length)) != extension ){
			pathname+= extension;
		}
		return pathname;
	},

	/*
	on utiliseras ça surement, ça permet des choses comme
	System.paths['lodash'] = '/js/lodash.js';
	System.paths['lodash/*'] = '/js/lodash/*.js';
	System.locate('lodash'); /js/lodash.js
	System.locate('lodash/map'); /js/lodash/map.js
	*/
	locatePath: function(name, key, value){
		var starIndex = key.indexOf('*'), location = false;

		if( starIndex === -1 ){
			if( name === key ){
				location = value;
			}
		}
		else{
			var left = key.slice(0, starIndex), right = key.slice(starIndex + 1);
			var nameLeft = name.slice(0, left.length), nameRight = name.slice(name.length - right.length);

			if( left == nameLeft && right == nameRight ){
				location = value.replace('*', name.slice(left.length, name.length - right.length));
			}
		}

		return location;
	},

	locate: function(base, name){
		// most specific (longest) match wins
		var paths = this.paths, location = name, path, match;

		// check to see if we have a paths entry
		for( path in paths ){
			match = this.locatePath(name, path, paths[path]);

			if( match && match.length > location.length ){
				location = match;
			}
		}

		var url = System.resolveUrl(base, location), queryIndex = url.indexOf('?');
		if( queryIndex != -1 ){
			url = this.forceExtension(url.slice(0, queryIndex), this.extension) + url.slice(queryIndex);
		}
		else{
			url = this.forceExtension(url, this.extension);
		}

		return url;
	},

	import: function(name){
		var filename = System.locate(System.baseUrl, name);
		var module = new Module(filename);
		return module.ready();
	},

	define: function(name, source){
		var filename = System.locate(System.baseUrl, name);
		
		if( filename in Module.cache ){
			throw new Error('a module named ' + name + ' already exists');
		}

		var module = new Module(filename);
		module.exports = exports;
		return module.ready();
	}
};

var Module = {
	filename: null, // resolved filename
	dependencies: null, // module required by this one
	dependents: null, // module requiring this one
	cache: {},
	urlCache: null, // contain cache of resolved urls

	source: null, // module source as string
	fn: null, // the module method
	exports: null, // the value returned by fn()
	meta: null, // maybe usefull a day
	version: null, // will be supported later

	constructor: function(filename){
		if( filename in this.cache ){
			return this.cache[filename];
		}

		this.filename = filename;
		this.cache[filename] = this;
		this.urlCache = {};

		this.dependencies = [];
		this.dependents = [];
	},

	toString: function(){
		return '[Module ' + this.filename + ']';
	},

	createDependency: function(filename){
		var module = new Module(filename);

		if( module === this ){
			throw new Error(this.filename + ' cannot depends on himself');
		}
		if( this.dependencies.indexOf(module) !== -1 ){
			throw new Error(this.filename + ' is dependant of ' + filename);
		}

		debug(this, 'depends on', filename);

		if( this.dependencies.indexOf(module) === -1 ){
			this.dependencies.push(module);
		}
		if( module.dependents.indexOf(this) === -1 ){
			module.dependents.push(this);
		}

		return module;
	},

	load: function(){
		var promise;

		debug('loading', this);

		if( this.hasOwnProperty('source') ){
			promise = Promise.resolve(this.source);
		}
		else{
			var filename = this.filename;

			// fetchTextFromFile()
			if( filename.slice(0, 5) === 'file:' ){
				filename = filename.slice(5);
				promise = System.fetchTextFromFile(filename);
			}
			// fetchTextFromURl()
			else{
				promise = System.fetchTextFromURL(filename);
			}
			
			promise = promise.then(function(source){
				return this.source = source;
			}.bind(this));
		}

		return promise;
	},

	scan: function(){
		var dependencyNames;

		debug('scanning', this, 'dependencies');

		if( this.hasOwnProperty('dependencyNames') ){
			dependencyNames = this.dependencyNames;
		}
		else{
			dependencyNames = moduleScanner.scan(this.source).map(function(requireCall){
				return requireCall.module;
			});
			this.dependencyNames = dependencyNames;
		}

		return dependencyNames;
	},

	locate: function(name){
		var url;

		if( name in this.urlCache ){
			url = this.urlCache[name];
		}
		else{
			url = System.locate(this.filename, name);
			this.urlCache[name] = url;
		}

		debug('resolving', name, 'to', url);

		return url;
	},

	createDependencies: function(){
		var dependencyPaths = this.dependencyNames.map(this.locate, this);
		var dependencies = dependencyPaths.map(this.createDependency, this);
		return dependencies;
	},

	compile: function(){
		var result;

		if( this.hasOwnProperty('exports') ){
			result = this.exports;
		}
		else{
			var code = '(function(module, require){\n\n' + this.source + '\n\n})', fn;

			fn = System.eval(code, this.filename); // can throw syntax/reference error in module source
			this.fn = fn;
			result = fn.call(System.global, this, this.require.bind(this)); // can throw error too
			this.exports = result;

			// when a dependency is modified I may need to recall fn (without evaluating source)
		}

		return result;
	},

	ready: function(){
		var promise;

		if( this.promise ){
			promise = this.promise;
		}
		else{
			promise = this.load().then(function(){
				this.scan();
				this.createDependencies();
				return Promise.all(this.dependencies.map(function(dependency){
					return dependency.ready();
				}));
			}.bind(this)).then(function(){
				return this.compile();
			}.bind(this));

			this.promise = promise;
		}

		return promise;
	},

	require: function(name){
		var url = this.locate(name), module;

		if( !(url in this.cache) ){
			throw new Error(url + ' module was not preloaded');
		}

		module = this.cache[url];

		if( !module.hasOwnProperty('exports') ){
			throw new Error(name + 'module exports is null');
		}

		return module.exports;
	}
};

Module.constructor.prototype = Module;
Module = Module.constructor;

// browser
if( typeof window !== 'undefined' ){
	System.platform = 'browser';
	System.global = window;
	System.baseUrl = window.location.origin;
	System.eval = function(code, filename){
		if( filename ) code+= '\n//# sourceURL=' + filename;
		return window.eval(code);
	};
	//System.fetchTextFromFile = function(filename){}; // use FileSystem API
	System.fetchTextFromURL = function(scriptUrl){
		var url = encodeURI(scriptUrl);
		
		var request = new Request({
			method: 'get',
			url: url
		});

		return request.catch(function(error){
			if( request.status == 404 ){
				return this.createModuleNotFoundError(url);
			}
		}.bind(this));
	};
	System.resolveUrl = function(from, to){
		var head = document.head;
		var base = document.createElement('base');
		var a = document.createElement('a');
		var url;

		head.insertBefore(base, head.firstChild);
		base.href = from;
		a.href = to;
		url = a.href;

		head.removeChild(base);

		return url;
	};
}
// node
else if( typeof process !== 'undefined' ){
	System.platform = 'node';
	System.global = global;
	System.baseUrl = 'file:' + process.cwd() + '/';

	if( process.platform.match(/^win/) ){
		System.baseUrl = System.baseUrl.replace(/\\/g, '/');
	}

	// node core modules
	//var natives = process.binding('natives');
	//for(var key in natives) System.define(key, natives[key]);

	// in node env, just require the dependencies
	// (browser env must include script tag with the dependencies prior to including system.js)
	System.dependencies.forEach(function(dependency){
		require('./core/' + dependency + '.js');
	});

	var vm = require('vm');
	System.eval = function(code, filename){
		return vm.runInThisContext(code, {
			filename: filename
		});
	};
	var fs = require('fs');
	System.fetchTextFromFile = function(filename, callback){
		return new Promise(function(resolve, reject){
			fs.readFile(filename, function(error, source){
				if( error ) reject(error);
				else resolve(source);
			});
		}).catch(function(error){
			if( error && error.code == 'ENOENT' ){
				return this.createModuleNotFoundError(filename);
			}
		}.bind(this));
	};
	// System.fetchTextFromUrl = function(){}; // use httpRequest
	var URL = require('url');
	System.resolveUrl = function(from, to){
		return URL.resolve(from, to);
	};
}
// other js envs
else{
	throw new Error('your javascript environment in not supported');
}

System.dependencies.forEach(function(dependency){
	var dependencyName = dependency[0].toUpperCase() + dependency.slice(1);

	if( !(dependencyName in System.global) ){
		throw new Error('system is dependent of ' + dependencyName + ' but it cannot find it in the global env');
	}
});

System.global.System = System;

if( System.platform === 'node' && require.main === module ){
	System.import(process.argv[2]).then(console.log, function(e){
		console.error(e.stack);
	});
}