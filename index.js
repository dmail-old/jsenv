/*

inspiration:
https://github.com/joyent/node/blob/master/lib/module.js
https://github.com/joyent/node/blob/master/src/node.js
http://fredkschott.com/post/2014/06/require-and-the-module-system/?utm_source=nodeweekly&utm_medium=email

comment rajouter le .js si il manque?
comment aller chercher proto/index.js lorsque je tape 'proto' (a priori on devra l'indiquer)

*/

var Ajax = require('./ajax');
require('@dmail/promise');
require('@dmail/promise/pipe');
require('@dmail/promise/callback');
require('@dmail/promise/map');
var moduleScanner = require('./module-scanner');

function locate(name, pathName, pathValue){
	var starIndex = pathName.indexOf('*'), location = false;

	if( starIndex === -1 ){
		if( name === pathName ){
			location = pathValue;
		}
	}
	else{
		var left = pathName.slice(0, starIndex), right = pathName.slice(starIndex + 1);
		var nameLeft = name.slice(0, left.length), nameRight = name.slice(name.length - right.length);

		if( left == nameLeft && right == nameRight ){
			location = pathValue.replace('*', name.slice(left.length, name.length - right.length));
		}
	}

	return location;
}

var System = {
	core: {},
	paths: {},
	extension: '.js',

	resolve: function(base, uri){
		var url = System.resolveUrl(base, uri);

		if( url.slice(-(System.extension.length)) != System.extension ){
			url+= '.js';
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
	locate: function(name){
		// most specific (longest) match wins
		var paths = this.paths, location = '', path, match;

		// check to see if we have a paths entry
		for( path in paths ){
			match = locate(name, path, paths[path]);

			if( match && match.length > location.length ){
				location = match;
			}
		}

		return this.resolve(this.baseUrl, location);
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
	resolvedIds: null, // contain id already resolved to uri for this module
	extension: '.js', // default extension

	source: null, // module source as string
	fn: null, // the module method
	exports: null, // the value returned by module.fn()

	vesion: null,
	meta: null,

	constructor: function(filename){
		if( filename in this.cache ){
			return this.cache[filename];
		}

		this.filename = filename;
		this.cache[filename] = this;
		this.resolvedIds = {};

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

		if( name in this.resolvedIds ){
			url = this.resolvedIds[name];
		}
		else{
			url = System.resolve(this.filename, name);
			this.resolvedIds[name] = url;
		}

		debug('resolving', name, 'to', url);

		return url;
	},

	createDependencies: function(){
		var dependencyPaths = this.dependencyNames.map(this.resolve, this);
		var dependencies = dependencyPaths.map(this.createDependency, this);
		return dependencies;
	},

	ready: function(){
		return Promise.pipe([
			this.load,
			this.scan,
			this.createDependencies,
			function(){
				return Promise.map(this.dependencies, function(dependency){
					return dependency.ready();
				}, this);
			}
		], this);
	},

	compile: function(){
		var code, fn;

		debug('compile module function', this);

		code = '(function(module, require){\n\n' + this.source + '\n\n})';

		try{
			fn = System.eval(code, this.filename);
		}
		catch(e){
			// syntax/reference error in module source
			throw e;
		}

		return this.fn = fn;
	},

	exec: function(){
		var result;

		debug('exec module', this);

		try{
			result = this.fn.call(System.global, this, this.require.bind(this));
		}
		catch(e){
			// execution of the module code raise an error
			throw e;
		}

		debug('got the result', result);

		return this.exports = result;
	},

	run: function(){
		// dès que le module est prêt on peut l'éxécuter
		return this.ready().then(function(){
			this.compile();
			return this.exec();
		}.bind(this));
	},

	require: function(name){
		var url = this.resolve(name);
		var module = this.cache[url];

		module.compile();
		module.exec();

		return module.exports;
	}
};

Module.constructor.prototype = Module;
Module = Module.constructor;

System.import = function(name){
	var filename = System.resolve(System.baseUrl, name);
	var module = new Module(filename);
	return module.run();
};

System.define = function(name, source, options){
	var module = new Module(name);
	module.source = source;
	return module.run();
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