/* globals Request */

/*

inspiration:

https://github.com/kriszyp/nodules
https://github.com/ModuleLoader/es6-module-loader/blob/master/src/system.js

*/

var moduleScanner = require('./module-scanner');

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
			'.js'
		)+
		(href.protocol || href.authority || href.pathname ? href.search : (href.search || base.search)) +
		href.hash;
	}

	return absoluteUrl;
}

var ENV = {
	platform: 'unknown',
	platforms: [],
	globalName: 'ENV',
	global: null,
	baseUrl: null,
	extension: '.js',
	paths: {},
	protocols: {},
	implementations: [],
	dependencies: [
		'symbol', // because required by iterator
		'iterator', // because required by promise
		'promise' // because it's amazing
	],

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
		this.global = platform.getGlobal();
		this.global[this.globalName] = this;
		this.baseUrl = platform.getBaseUrl();

		var protocols = platform.getSupportedProtocols();
		if( protocols ){
			for(var key in protocols ) this.protocols[key] = protocols[key];
		}

		if( platform.setup ){
			platform.setup.call(this);
		}

		this.dependencies.forEach(function(dependency){
			var dependencyName = dependency[0].toUpperCase() + dependency.slice(1);

			if( !(dependencyName in this.global) ){
				throw new Error('system is dependent of ' + dependencyName + ' but it cannot find it in the global env');
			}
		}, this);

		if( platform.init ){
			platform.init.call(this);
		}
	},

	add: function(platform){
		this.platforms.push(platform);
	},

	eval: function(code, location){
		if( location ) code+= '\n//# sourceURL=' + location;
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

	locate: function(name){
		return this.locateFrom(this.baseUrl, name);
	},

	import: function(name){
		var location = ENV.locate(name);
		var module = new Module(location);
		return module.ready();
	},

	define: function(name, source){
		var location = ENV.locate(name);

		if( location in Module.cache ){
			throw new Error('a module named ' + name + ' already exists');
		}

		var module = new Module(location);
		module.exports = exports;
		return module.ready();
	}
};

var Module = {
	location: null, // location of the module
	dependencies: null, // module required by this one
	dependents: null, // module requiring this one
	cache: {},
	urlCache: null, // contain cache of resolved urls

	source: null, // module source as string
	fn: null, // the module method
	exports: null, // the value returned by fn()
	meta: null, // maybe usefull a day
	version: null, // will be supported later

	constructor: function(location){
		if( location in this.cache ){
			return this.cache[location];
		}

		this.location = location;
		this.cache[location] = this;
		this.urlCache = {};

		this.dependencies = [];
		this.dependents = [];
	},

	toString: function(){
		return '[Module ' + this.location + ']';
	},

	createDependency: function(location){
		var module = new Module(location);

		if( module === this ){
			throw new Error(this.location + ' cannot depends on himself');
		}
		if( this.dependencies.indexOf(module) !== -1 ){
			throw new Error(this.location + ' is dependant of ' + location);
		}

		debug(this, 'depends on', location);

		if( this.dependencies.indexOf(module) === -1 ){
			this.dependencies.push(module);
		}
		if( module.dependents.indexOf(this) === -1 ){
			module.dependents.push(this);
		}

		return module;
	},

	createModuleNotFoundError: function(location){
		var error = new Error('module not found ' + location);
		error.code = 'MODULE_NOT_FOUND';
		return error;
	},

	fetch: function(){
		var promise;

		debug('fetch', this);

		if( this.hasOwnProperty('source') ){
			promise = Promise.resolve(this.source);
		}
		else{
			var location = this.location;
			var protocol = location.slice(0, location.indexOf(':'));

			if( protocol in ENV.protocols ){
				promise = ENV.protocols[protocol](location).then(function(response){
					if( response.status === 404 ){
						throw this.createModuleNotFoundError(this.location);
					}
					else if( response.status != 200 ){
						throw new Error('cannot fetch, response status: ' + response.status);
					}

					return this.source = response.body;
				}.bind(this));
			}
			else{
				throw new Error('unsupported fetch protocol ' + protocol);
			}
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
			url = ENV.locateFrom(this.location, name);
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

			fn = ENV.eval(code, this.location); // can throw syntax/reference error in module source
			this.fn = fn;
			result = fn.call(ENV.global, this, this.require.bind(this)); // can throw error too
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
			promise = this.fetch().then(function(){
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