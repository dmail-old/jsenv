/*

inspiration:

https://github.com/kriszyp/nodules
https://github.com/ModuleLoader/es6-module-loader/blob/master/src/system.js

https://github.com/ModuleLoader/es6-module-loader/blob/master/src/loader.js#L885
https://gist.github.com/dherman/7568080
https://github.com/ModuleLoader/es6-module-loader/wiki/Extending-the-ES6-Loader

*/

function shortenPath(filepath){
	return require('path').relative(ENV.baseUrl, filepath);
}

function debug(){
	var args = Array.prototype.slice.call(arguments);

	args = args.map(function(arg){
		if( arg instanceof Module ){
			arg = shortenPath(arg.location);
		}
		else if( String(arg).match(/\\|\//) ){
			arg = shortenPath(arg);
		}
		return arg;
	});

	console.log.apply(console, args);
}

// object representing an attempt to locate/fetch/translate/parse a module
var Module = {
	loader: null, // loader used to load this module
	status: null, // loading, loaded, executed, failed
	meta: null,
	name: undefined, // the normalized module name, can be undefined for anonymous modules

	address: null, // result of locate()
	body: null, // result of fetch()
	source: null, // result of translate()
	dependencies: null, // result of collectDependencies()
	parsed: null, // result of parse()
	value: undefined, // result of execute()

	dependents: null, // set from dependencies

	exception: null, // why fetch() failed
	promise: null, // the promise representing the attempt to load the module

	constructor: function(loader, normalizedName){
		var module;

		if( normalizedName && loader.has(normalizedName) ){
			module = loader.get(normalizedName);
		}
		// create a load
		else{
			module = this;
			module.loader = loader;
			module.status = 'loading';
			module.meta = {};
			module.dependencies = [];
			module.dependents = [];

			if( normalizedName ){
				module.name = normalizedName;
				loader.modules[normalizedName] = module;
			}
		}

		return module;
	},

	toString: function(){
		return '[Module '+ this.name +']';
	},

	locate: function(){
		this.step = 'locate';

		var promise;

		if( this.hasOwnProperty('address') ){
			promise = Promise.resolve(this.address);
		}
		else{
			promise = this.loader.locate(this).then(function(address){
				this.address = address;
			}.bind(this));
		}

		return promise;
	},

	fetch: function(){
		this.step = 'fetch';

		var promise;

		if( this.hasOwnProperty('body') ){
			promise = Promise.resolve(this.body);
		}
		else{
			promise = this.loader.locate(this).then(function(body){
				this.body = body;
			}.bind(this));
		}

		return promise;
	},

	translate: function(){
		this.step = 'translate';

		var promise;

		if( this.hasOwnProperty('source') ){
			promise = Promise.resolve(this.source);
		}
		else{
			promise = this.loader.translate(this).then(function(source){
				this.source = source;
			}.bind(this));
		}

		return promise.then(function(){
			this.status = 'loaded';
		}.bind(this));
	},

	declareDependency: function(name){
		var normalizedName = this.loader.normalize(name, this.name, this.address);
		var moduleDependency = new Module(normalizedName);

		if( moduleDependency === this ){
			throw new Error(this + ' cannot depends on himself');
		}
		if( this.dependents.indexOf(moduleDependency) !== -1 ){
			throw new Error(this + ' is dependant of ' + moduleDependency);
		}

		debug(this, 'depends on', moduleDependency);

		if( this.dependencies.indexOf(moduleDependency) === -1 ){
			this.dependencies.push(moduleDependency);
		}
		if( moduleDependency.dependents.indexOf(this) === -1 ){
			moduleDependency.dependents.push(this);
		}

		return moduleDependency;
	},

	collectDependencies: function(){
		var result = this.loader.collectDependencies(this);

		if( result === undefined ){
			throw new TypeError('native es6 modules instantiation not supported');
		}
		else if( Object(result) === result ){
			result.forEach(this.declareDependency, this);
		}
		else{
			throw new TypeError('instantiate hook must return an object or undefined');
		}
	},

	loadDependencies: function(){
		// modules are thenable dependencies array is already an array of promise
		var loadPromises = this.dependencies;
		return Promise.all(this.dependencies);
	},

	parse: function(module){
		var parsed;

		if( this.hasOwnProperty('parsed') ){
			parsed = this.parsed;
		}
		else{
			parsed = this.loader.parse(this);
			this.parsed = parsed;
		}

		return parsed;
	},

	execute: function(){
		var value;

		if( this.hasOwnProperty('value') ){
			value = this.value;
		}
		else{
			value = this.loader.execute(this);
			this.value = value;
		}

		this.status = 'executed';

		return value;
	},

	createPromise: function(){
		var promise = Promise.resolve();

		[
			this.locate,
			this.fetch,
			this.translate,
			this.collectDependencies,
			this.loadDependencies,
			this.parse,
			this.execute
		].forEach(function(name){
			promise = promise.then(this[name].bind(this));
		}, this);

		promise = promise.catch(function(error){
			this.status = 'failed';
			this.exception = error;
		}.bind(this));

		return promise;
	},

	toPromise: function(){
		var promise;

		if( this.hasOwnProperty('promise') ){
			promise = this.promise;
		}
		else{
			promise = this.createPromise();
		}

		return promise;
	},

	then: function(onResolve, onReject){
		return this.toPromise().then(onResolve, onReject);
	}
};
Module.constructor.prototype = Module;
Module = Module.constructor;

var Loader = {
	modules: null, // module registry
	optionNames: [
		'normalize',
		'locate',
		'fetch',
		'translate',
		'collectDependencies',
		'parse',
		'execute'
	],

	constructor: function(options){
		if( options ){
			this.optionNames.forEach(function(method){
				if( options[method] ) this[method] = options[method];
			}, this);
		}

		this.modules = {};
	},

	normalize: function(name, contextName, contextAddress){
		return name;
	},

	locate: function(module){
		return module.name;
	},

	fetch: function(module){
		throw new TypeError('fetch not implemented');
	},

	translate: function(module){
		return module.body;
	},

	collectDependencies: function(){

	},

	parse: function(module){
		return module.source;
	},

	execute: function(module){
		return undefined;
	},

	get: function(normalizedName){
		if( this.has(normalizedName) ){
			return this.modules[normalizedName];
		}
		return undefined;
	},

	has: function(normalizedName){
		return normalizedName in this.modules;
	},

	set: function(normalizedName, module){
		if( false === module instanceof Module ){
			throw new TypeError('Loader.set(' + normalizedName + ', module) must be a module');
		}
		this.modules[normalizedName] = module;
	},

	delete: function(normalizedName){
		if( this.has(normalizedName) ){
			delete this.modules[normalizedName];
			return true;
		}
		return false;
	},

	entries: function(){ return Iterator(this.modules, 'key+value'); },
	keys: function(){ return Iterator(this.modules, 'key'); },
	values: function(){ return Iterator(this.modules, 'value'); },

	define: function(normalizedName, source, options){
		normalizedName = String(normalizedName);
		// replace any existing module with the defined one
		if( this.has(normalizedName) ){
			this.delete(normalizedName);
		}

		var module = new Module(normalizedName);

		module.address = normalizedName; // prevent locate()
		module.source = source; // prevent fetch()

		if( options ){
			if( options.meta ){
				module.meta = options.meta;
			}
			if( options.address ){
				module.address = options.address;
			}
		}

		return Promise.resolve(module).then(function(){});
	},

	load: function(normalizedName, options){
		normalizedName = String(normalizedName);

		var module = new Module(normalizedName);

		// prevent locate()
		if( options && options.address ){
			module.address = options.address;
		}

		return module.locate().then(function(){
			return module.fetch();
		});
	},

	// execute a top level anonymous module, not registering it
	module: function(source, options){
		var module = new Module();

		// prevent locate()
		if( options && options.address ){
			module.address = options.address;
		}
		// prevent fetch()
		module.source = source;

		return module.then(function(){
			return module;
		});
	},

	import: function(normalizedName, options){
		normalizedName = String(normalizedName);

		var module = new Module(normalizedName);

		// prevent locate()
		if( options && options.address ){
			module.address = options.address;
		}

		return module.then(function(){
			return module;
		});
	}
};

// https://gist.github.com/Yaffle/1088850
function parseURI(url){
	url = String(url);
	url = url.replace(/^\s+|\s+$/g, ''); // trim
	var match = url.match(/^([^:\/?#]+:)?(\/\/(?:[^:@\/?#]*(?::[^:@\/?#]*)?@)?(([^:\/?#]*)(?::(\d*))?))?([^?#]*)(\?[^#]*)?(#[\s\S]*)?/);
	// authority = '//' + user + ':' + pass '@' + hostname + ':' port
	var parsed = null;

	if( match ){
		parsed = {
			href     : match[0] || '',
			protocol : match[1] || '',
			authority: match[2] || '',
			host     : match[3] || '',
			hostname : match[4] || '',
			port     : match[5] || '',
			pathname : match[6] || '',
			search   : match[7] || '',
			hash     : match[8] || ''
		};
	}

	return parsed;
}

function removeDotSegments(input){
	var output = [];

	input
	.replace(/^(\.\.?(\/|$))+/, '')
	.replace(/\/(\.(\/|$))+/g, '/')
	.replace(/\/\.\.$/, '/../')
	.replace(/\/?[^\/]*/g, function(p){
		if( p === '/..' )
			output.pop();
		else
			output.push(p);
	});

	return output.join('').replace(/^\//, input.charAt(0) === '/' ? '/' : '');
}

function forceExtension(pathname, extension){
	if( pathname.slice(-(extension.length)) != extension ){
		pathname+= extension;
	}
	return pathname;
}

function toAbsoluteURL(base, href){
	href = parseURI(href || '');
	base = parseURI(base || '');

	var absoluteUrl = null;

	if( href && base ){
		absoluteUrl =
		(href.protocol || base.protocol) +
		(href.protocol || href.authority ? href.authority : base.authority) +
		forceExtension(
			removeDotSegments(
				href.protocol || href.authority || href.pathname.charAt(0) === '/' ? href.pathname : (href.pathname ? ((base.authority && !base.pathname ? '/' : '') + base.pathname.slice(0, base.pathname.lastIndexOf('/') + 1) + href.pathname) : base.pathname)
			),
			ENV.extension
		)+
		(href.protocol || href.authority || href.pathname ? href.search : (href.search || base.search)) +
		href.hash;
	}

	return absoluteUrl;
}

var collectDependencies = (function(){
	// https://github.com/jonschlinkert/strip-comments/blob/master/index.js
	var reLine = /(^|[^\S\n])(?:\/\/)([\s\S]+?)$/gm;
	var reLineIgnore = /(^|[^\S\n])(?:\/\/[^!])([\s\S]+?)$/gm;
	function stripLineComment(str, safe){
		return String(str).replace(safe ? reLineIgnore : reLine, '');
	}

	var reBlock = /\/\*(?!\/)(.|[\r\n]|\n)+?\*\/\n?\n?/gm;
	var reBlockIgnore = /\/\*(?!(\*?\/|\*?\!))(.|[\r\n]|\n)+?\*\/\n?\n?/gm;
	function stripBlockComment(str, safe){
		return String(str).replace(safe ? reBlockIgnore : reBlock, '');
	}

	//https://github.com/jonschlinkert/requires-regex/blob/master/index.js
	var reDependency = /^[ \t]*(var[ \t]*([\w$]+)[ \t]*=[ \t]*)?include\(['"]([\w\W]+?)['"]\)/gm;
	function collectDependencies(str, keepComments){
		if( !keepComments ){
			str = stripLineComment(stripBlockComment(str));
		}

		var lines = str.split('\n'), len = lines.length, i = 0, calls = [], match, line;

		while(len--){
			line = lines[i++];
			match = reDependency.exec(line);
			if( match ){
				calls.push({
					line: i,
					variable: match[2] || '',
					name: match[3],
					original: line
				});
			}
		}

		return calls;
	}

	return collectDependencies;
})();

var ENV = {
	platform: 'unknown',
	platforms: [],
	globalName: 'ENV',
	global: null,
	protocols: {},
	baseUrl: null,
	extension: '.js',
	paths: {},
	dependencies: [
		'symbol', // because required by iterator
		'iterator', // because required by promise
		'promise' // because it's amazing
	],

	add: function(platform){
		this.platforms.push(platform);
	},

	init: function(){
		var platforms = this.platforms, i = 0, j = platforms.length, platform;

		for(;i<j;i++){
			platform = platforms[i];
			if( platform.test.call(this) ){
				break;
			}
		}

		if( !platform ){
			throw new Error('your javascript environment in not supported');
		}

		this.platform = platform.name;
		this.global = platform.getGlobal(); // mandatory
		this.global[this.globalName] = this;

		if( platform.getSupportedProtocols ){ // optionnal
			var protocols = platform.getSupportedProtocols();
			if( protocols ){
				for(var key in protocols ) this.protocols[key] = protocols[key];
			}
		}

		this.baseUrl = platform.getBaseUrl(); // mandatory

		if( platform.setup ){ // optionnal
			platform.setup.call(this);
		}

		this.dependencies.forEach(function(dependency){
			var dependencyName = dependency[0].toUpperCase() + dependency.slice(1);

			if( !(dependencyName in this.global) ){
				throw new Error('system is dependent of ' + dependencyName + ' but it cannot find it in the global env');
			}
		}, this);

		if( platform.init ){ // optionnal
			platform.init.call(this);
		}
	},

	eval: function(code, url){
		if( url ) code+= '\n//# sourceURL=' + url;
		return eval(code);
	},

	/*
	on utiliseras ça surement, ça permet des choses comme
	ENV.paths['lodash'] = '/js/lodash.js';
	ENV.paths['lodash/*'] = '/js/lodash/*.js';
	ENV.locate('lodash'); /js/lodash.js
	ENV.locate('lodash/map'); /js/lodash/map.js
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

	locateFrom: function(base, name){
		// most specific (longest) match wins
		var paths = this.paths, location = name, path, match;

		// check to see if we have a paths entry
		for( path in paths ){
			match = this.locatePath(name, path, paths[path]);

			if( match && match.length > location.length ){
				location = match;
			}
		}

		var url = toAbsoluteURL(base, location);

		return url;
	},

	createModuleNotFoundError: function(location){
		var error = new Error('module not found ' + location);
		error.code = 'MODULE_NOT_FOUND';
		return error;
	},

	normalize: function(name, contextName, contextAddress){
		if( typeof name != 'string' ){
			throw new TypeError('Module name must be a string');
		}

		var segments = name.split('/');

		if( segments.length === 0 ){
			throw new TypeError('No module name provided');
		}

		// current segment
		var i = 0;
		// is the module name relative
		var rel = false;
		// number of backtracking segments
		var dotdots = 0;

		if( segments[0] == '.' ){
			i++;
			if( i == segments.length ){
				throw new TypeError('Illegal module name "' + name + '"');
			}
			rel = true;
		}
		else{
			while( segments[i] == '..' ){
				i++;
				if( i == segments.length ){
					throw new TypeError('Illegal module name "' + name + '"');
				}
			}
			if( i ){
				rel = true;
			}
			dotdots = i;
		}

		var j = i, segment;
		for(;j<segments.length;j++){
			segment = segments[j];
			if( segment === '' || segment == '.' || segment == '..' ){
				throw new TypeError('Illegal module name "' + name + '"');
			}
		}

		if( !rel ){
			return name;
		}

		// build the full module name
		var normalizedParts = [];
		var parentParts = (contextName || '').split('/');
		var normalizedLen = parentParts.length - 1 - dotdots;

		normalizedParts = normalizedParts.concat(parentParts.splice(0, parentParts.length - 1 - dotdots));
		normalizedParts = normalizedParts.concat(segments.splice(i, segments.length - i));

		return normalizedParts.join('/');
	},

	locate: function(module){
		var address = this.locateFrom(this.baseUrl, module.name);

		module.meta.location = parseURI(address);

		return address;
	},

	fetch: function(module){
		var location = module.meta.location;
		var protocol = location.protocol;
		var href = location.href;

		if( !(protocol in ENV.protocols) ){
			throw new Error('unsupported fetch protocol ' + protocol);
		}

		return ENV.protocols[protocol](href).then(function(response){
			if( response.status === 404 ){
				throw this.createModuleNotFoundError(href);
			}
			else if( response.status != 200 ){
				throw new Error('cannot fetch, response status: ' + response.status);
			}

			return response.body;
		}.bind(this));
	},

	collectDependencies: function(module){
		return collectDependencies(module.source).map(function(includeCall){
			return includeCall.name;
		});
	},

	parse: function(module){
		return this.eval('(function(module, include){\n\n' + module.source + '\n\n})', module.address);
	},

	execute: function(module){
		return module.parsed.call(ENV.global, module, ENV.include.bind(ENV));
	},

	include: function(name){
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

// browser
ENV.add({
	name: 'browser',

	test: function(){
		return typeof window !== 'undefined';
	},

	getGlobal: function(){
		return window;
	},

	getBaseUrl: function(){
		var href = window.location.href.split('#')[0].split('?')[0];
		var baseUrl = href.slice(0, href.lastIndexOf('/') + 1);

		return baseUrl;
	},

	getSupportedProtocols: function(){
		var protocols = {};

		// https://gist.github.com/mmazer/5404301
		function parseHeaders(headerString){
			var headers = {}, pairs, pair, index, i, j, key, value;

			if( headerString ){
				pairs = headerString.split('\u000d\u000a');
				i = 0;
				j = pairs.length;
				for(;i<j;i++){
					pair = pairs[i];
					index = pair.indexOf('\u003a\u0020');
					if( index > 0 ){
						key = pair.slice(0, index);
						value = pair.slice(index + 2);
						headers[key] = value;
					}
				}
			}

			return headers;
		}

		protocols.http = function(url){
   			return new Promise(function(resolve, reject){
				var xhr = new XMLHttpRequest();

				xhr.onreadystatechange = function () {
					if( xhr.readyState === 4 ){
						resolve({
							status: xhr.status,
							body: xhr.responseText,
							headers: parseHeaders(xhr.getAllResponseHeaders())
						});
					}
				};
		     	xhr.open('GET', url);
		     	xhr.send(null);
		   });
   		};
   		protocols.https = protocols.http;
   		protocols.file = function(url){
   			return protocols.http(url).then(function(response){
				// fix for browsers returning status == 0 for local file request
				if( response.status === 0 ){
					response.status = response.body ? 200 : 404;
				}
				return response;
			});
   		};

   		return protocols;
	}
});

// node
ENV.add({
	name: 'node',

	test: function(){
		return typeof process !== 'undefined';
	},

	getGlobal: function(){
		return global;
	},

	getBaseUrl: function(){
		var baseUrl = 'file://' + __dirname + '/';

		if( process.platform.match(/^win/) ){
			baseUrl = baseUrl.replace(/\\/g, '/');
		}

		return baseUrl;
	},

	getSupportedProtocols: function(){
		var http = require('http');
		var https = require('https');

		var protocols = {};

		protocols.http = function(url, isHttps){
			return new Promise(function(resolve, reject){
				var httpRequest = (isHttps ? https : http).request({
					method: 'GET',
					url: url,
					port: isHttps ? 443 : 80
				});

				function resolveWithHttpResponse(httpResponse){
					var response = {
						status: httpResponse.statusCode,
						headers: httpResponse.headers
					};

					var buffers = [], length;
					httpResponse.addListener('data', function(chunk){
						buffers.push(chunk);
						length+= chunk.length;
					});
					httpResponse.addListener('end', function(){
						resolve({
							status: httpResponse.statusCode,
							headers: httpResponse.headers,
							body: Buffer.concat(buffers, length).toString()
						});
					});
					response.addListener('error', reject);
				}

				httpRequest.addListener('response', resolveWithHttpResponse);
				httpRequest.addListener('error', reject);
				httpRequest.addListener('timeout', reject);
				httpRequest.addListener('close', reject);
			});
		};
		protocols.https = function(url){
			return protocols.http(url, true);
		};

		var fs = require('fs');
		protocols.file = function(path){
			path = path.slice('file://'.length);

			return new Promise(function(resolve, reject){
				fs.readFile(path, function(error, source){
					if( error ){
						if( error.code == 'ENOENT' ){
							resolve({
								status: 404,
							});
						}
						else{
							reject(error);
						}
					}
					else{
						resolve({
							status: 200,
							body: source,
							headers: {}
						});
					}
				});
			});
		};

		return protocols;
	},

	setup: function(){
		// node core modules
		//var natives = process.binding('natives');
		//for(var key in natives) System.define(key, natives[key]);

		// in node env, just require the dependencies
		// (browser env must include script tag with the dependencies prior to including system.js)
		this.dependencies.forEach(function(dependency){
			require('./core/' + dependency + '.js');
		});
	},

	init: function(){
		if( require.main === module ){
			this.import(process.argv[2]).then(console.log, function(e){
				console.error(e.stack);
			});
		}
	}
});

ENV.init();