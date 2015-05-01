/*

inspiration:
https://github.com/joyent/node/blob/master/lib/module.js
https://github.com/joyent/node/blob/master/src/node.js
http://fredkschott.com/post/2014/06/require-and-the-module-system/?utm_source=nodeweekly&utm_medium=email

comment aller chercher proto/index.js lorsque je tape 'proto' (a priori on devra l'indiquer)

*/

var Ajax = require('./ajax');
require('@dmail/promise');
require('@dmail/promise/pipe');
require('@dmail/promise/callback');
require('@dmail/promise/map');
var moduleScanner = require('./module-scanner');

var SystemLocation = {
	extension: '.js',
	paths: {},

	forceExtension: function(pathname, extension){
		if( pathname.slice(-(extension.length)) != extension ){
			pathname+= extension;
		}
		return pathname;
	},

	resolve: function(base, uri){
		var url = System.resolveUrl(base, uri), queryIndex = url.indexOf('?');

		if( queryIndex != -1 ){
			url = this.forceExtension(url.slice(0, queryIndex), this.extension) + url.slice(queryIndex);
		}
		else{
			url = this.forceExtension(url, this.extension);
		}

		return url;
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
		var paths = this.paths, location = '', path, match;

		// check to see if we have a paths entry
		for( path in paths ){
			match = this.locatePath(name, path, paths[path]);

			if( match && match.length > location.length ){
				location = match;
			}
		}

		return this.resolve(base, location);
	}
};

var System = {
	core: {},
	baseUrl: null,

	resolveUrl: function(){
		throw new Error('unimplemented resolveUrl()');
	},

	readFile: function(){
		throw new Error('unimplemented readFile()');
	},

	eval: function(){
		throw new Error('unimplemented eval()');
	},

	resolve: function(name){
		return SystemLocation.resolve(this.baseUrl, name);
	}
};

System.core.ajax = Ajax;
System.core.promise = Promise;
System.core.moduleScanner = moduleScanner;

// browser
if( typeof window !== 'undefined' ){
	System.platform = 'browser'; // or 'navigator'
	System.global = window;
	System.baseUrl = '.' + window.location.pathname;
	System.eval = function(code, filename){
		if( filename ) code+= '\n//# sourceURL=' + filename;
		return window.eval(code);
	};
	System.readFile = function(scriptUrl){
		var url = 'resolve?path={path}';
		url = url.replace('{path}', encodeURIComponent(scriptUrl));
		url = window.location.origin + '/' + url;

		return Promise.resolve(new Ajax({
			method: 'get',
			url: url
		}));
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
	System.baseUrl = __filename; // process.cwd();
	// this.baseURL.replace(/\\/g, '/');

	// node core modules
	var natives = process.binding('natives');
	for(var key in natives) System.core[key] = natives[key];

	var vm = require('vm');
	System.eval = function(code, filename){
		return vm.runInThisContext(code, {
			filename: filename
		});
	};
	var fs = require('fs');
	System.readFile = function(filename){
		return Promise.callback(function(complete){
			fs.readFile(filename, complete);
		});
	};
	var URL = require('url');
	System.resolveUrl = function(from, to){
		return URL.resolve(from, to);
	};
}
// other js envs
else{
	throw new Error('your javascript environment in not supported');
}

System.global.System = System;

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
			promise = System.readFile(this.filename);
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

	resolve: function(name){
		var url;

		if( name in this.urlCache ){
			url = this.urlCache[name];
		}
		else{
			url = SystemLocation.resolve(this.filename, name);
			this.urlCache[name] = url;
		}

		debug('resolving', name, 'to', url);

		return url;
	},

	createDependencies: function(){
		var dependencyPaths = this.dependencyNames.map(this.resolve, this);
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

			debug(this, 'has returned', result);
		}

		return result;
	},

	ready: function(){
		var promise;

		if( this.promise ){
			promise = this.promise;
		}
		else{
			promise = Promise.pipe([
				this.load,
				this.scan,
				this.createDependencies,
				function(){
					return Promise.map(this.dependencies, function(dependency){
						return dependency.ready();
					}, this);
				},
				this.compile
			], this);
			this.promise = promise;
		}

		return promise;
	},

	require: function(name){
		var url = this.resolve(name);
		var module = this.cache[url];

		return module.exports;
	}
};

Module.constructor.prototype = Module;
Module = Module.constructor;

System.import = function(name){
	var filename = System.resolve(name);
	var module = new Module(filename);
	return module.ready();
};

System.define = function(name, source, options){
	var module = new Module(name);
	module.source = source;
	return module.ready();
};

if( System.platform === 'node' && require.main === module ){
	System.import(process.argv[2]).then(console.log, function(e){
		console.error(e.stack);
	});
}

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

module.exports = System;

/*
System.parseUrl = function(url){
	return URL.parse(url);
};
System.formatUrl = function(url){
	return URL.format(url);
};

System.parseUrl = function(url){
	var a = document.createElement('a');
	a.href = url;
	return {
		href: url,
		protocol: a.protocol.replace(':',''),
		slashes: true, // todo,
		host: a.hostname,
		auth: '', // todo
		hostname: a.hostname.toLowerCase(),
		port: a.port,
		pathname: a.pathname,
		search: a.search,
		path: a.pathname + a.search,
		query: a.search.slice(1),
		hash: a.hash.replace('#','')
	};
};

System.formatUrl = function(properties){
		return properties.protocal + properties.host + properties.pathname + properties.search + properties.hash;
};
*/