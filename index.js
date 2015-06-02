/*

inspiration:

https://github.com/kriszyp/nodules
https://github.com/ModuleLoader/es6-module-loader/blob/master/src/system.js
https://github.com/ModuleLoader/es6-module-loader/blob/master/src/loader.js#L885
https://gist.github.com/dherman/7568080
https://github.com/ModuleLoader/es6-module-loader/wiki/Extending-the-ES6-Loader

origin devrait passer par la config aussi
github://dmail@argv -> github://dmail@argv/main.js si module.meta.main = "main"
il faudrais limit appeler locate() sur origin

*/

function forOf(iterable, fn, bind){
	var method, iterator, next;

	method = iterable[Symbol.iterator];

	if( typeof method !== 'function' ){
		throw new TypeError(iterable + 'is not iterable');
	}

	if( typeof fn != 'function' ){
		throw new TypeError('second argument must be a function');
	}

	iterator = method.call(iterable);
	next = iterator.next();
	while( next.done === false ){
		if( fn.call(bind, next.value) === true ){
			if( typeof iterator['return'] === 'function' ){
				iterator['return']();
			}
			break;
		}
		next = iterator.next();
	}

	return this;
}

function debug(){
	var args = Array.prototype.slice.call(arguments);

	args = args.map(function(arg){
		if( arg && typeof arg == 'object' && 'name' in arg ){
			arg = arg.name ? String(arg.name) : 'anonymous module';
		}
		return arg;
	});

	console.log.apply(console, args);
}

function create(proto){
	proto.constructor.prototype = proto;
	return proto.constructor;
}

function extend(constructor, proto){
	var object = Object.create(constructor.prototype);
	for(var key in proto ) object[key] = proto[key];
	object.constructor.prototype = object;
	return object.constructor;
}

function replace(string, values){
	return string.replace((/\\?\{([^{}]+)\}/g), function(match, name){
		if( match.charAt(0) == '\\' ) return match.slice(1);
		return (values[name] != null) ? values[name] : '';
	});
}

if( !Object.assign ){
	Object.assign = function(object){
		var i = 1, j = arguments.length, owner, keys, n, m, key;

		for(;i<j;i++){
			owner = arguments[i];
			if( Object(owner) != owner ) continue;
			keys = Object.keys(owner);
			n = 0;
			m = keys.length;

			for(;n<m;n++){
				key = keys[n];
				object[key] = owner[key];
			}
		}
	};
}

(function(){
	var jsenv = {
		state: 'created'
	};

	// requirements
	var Requirement = create({
		path: null,

		constructor: function(options){
			if( typeof options === 'string' ){
				options = {path: options};
			}

			Object.assign(this, options);
		},

		has: function(){
			return false;
		},

		onResolve: function(){

		},

		onReject: function(error){
			throw new Error('An error occured during requirement loading at ' + this.path + '\n' + error);
		}
	});

	Object.assign(jsenv, {
		requirements: [],

		need: function(requirement){
			requirement = new Requirement(requirement);

			if( this.state == 'created' ){
				this.requirements.push(requirement);
			}
			else if( this.state == 'loading' ){
				this.requirements.splice(this.requirementIndex, 0, requirement);
			}
			else{
				throw new Error('you can declare a requirement only before or during loading');
			}
		},

		loadRequirements: function(){
			this.global.forOf = this.forOf = forOf;

			var self = this, requirements = this.requirements, requirement;

			self.requirementIndex = 0;

			function loadRequirement(){
				if( requirement.has() ){
					debug('SKIP', requirement.path);
					nextRequirement();
				}
				else{
					var url = requirement.path;
					// / means relative to the jsenv dirname here, not the env root
					if( url[0] === '/' ) url = self.platform.dirname + url;
					else if( url.slice(0, 2) === './' ) url = self.baseURI + url.slice(2);

					debug('REQUIRE', url);
					self.platform.load(url, onRequirementLoad);
				}
			}

			function onRequirementLoad(error){
				if( error ){
					requirement.onReject(error);
				}
				else{
					requirement.onResolve();
					//debug('REQUIRED', requirement.path);
					nextRequirement();
				}
			}

			function nextRequirement(){
				if( self.requirementIndex >= self.requirements.length ){
					//debug('ALL-REQUIREMENTS-COMPLETED');
					self.onload();
				}
				else{
					requirement = self.requirements[self.requirementIndex];
					self.requirementIndex++;
					loadRequirement();
				}
			}

			nextRequirement();
		}
	});

	// storages
	var Storage = create({
		constructor: function(platform, name, options){
			this.platform = platform;
			this.name = name;
			Object.assign(this, options);
		}
	});

	// platforms
	var Platform = create({
		constructor: function(env, type, options){
			this.env = env;
			this.type = String(type);
			if( options ){
				Object.assign(this, options);
			}
		},

		setup: function(){
			this.name = this.getName();
			this.version = this.getVersion();
			debug('platform type :', this.type, '(', this.name, this.version, ')');

			this.global = this.getGlobal();
			this.baseURL = this.getBaseUrl();
			this.filename = this.getSrc();
			this.dirname = this.filename.slice(0, this.filename.lastIndexOf('/'));
		},

		createModuleHttpRequest: function(url, options){
			if( options.mtime ){
				options.headers = options.headers || {};
				options.headers['if-modified-since'] = options.mtime;
			}

			return this.httpRequestFactory(url, options).then(function(response){
				if( response.headers && 'last-modified' in response.headers ){
					response.mtime = new Date(response.headers['last-modified']);
				}
				return response;
			});
		},

		createHttpStorage: function(){
			return this.createStorage('http', {
				get: function(url, options){
					options.method = options.method || 'GET';
					return this.platform.createModuleHttpRequest(url, options);
				},

				set: function(url, body, options){
					options.method = options.method || 'POST';
					options.body = body;
					return this.platform.createModuleHttpRequest(url, options);
				}
			});
		},

		createHttpsStorage: function(){
			return this.createStorage('https', {
				get: function(url, options){
					options.method = 'GET';
					return this.platform.createModuleHttpRequest(url, options);
				},

				set: function(url, body, options){
					options.method = options.method || 'POST';
					options.body = body;
					return this.platform.createModuleHttpRequest(url, options);
				}
			});
		},

		/*
		live example
		var giturl = 'https://api.github.com/repos/dmail/argv/contents/index.js?ref=master';
		var xhr = new XMLHttpRequest();
		var date = new Date();
		date.setMonth(0);

		xhr.open('GET', giturl);
		xhr.setRequestHeader('accept', 'application/vnd.github.v3.raw');
		xhr.setRequestHeader('if-modified-since', date.toUTCString());
		xhr.send(null);
		*/
		createGithubGetter: function(){
			return function(url, options){
				var parsed = new URI(url);
				var giturl = replace('https://api.github.com/repos/{user}/{repo}/contents/{path}?ref={version}', {
					user: parsed.username,
					repo: parsed.host,
					path: parsed.pathname ? parsed.pathname.slice(1) : 'index.js',
					version: parsed.hash ? parsed.hash.slice(1) : 'master'
				});

				options.method = 'GET';
				options.headers = options.headers || {};
				Object.assign(options.headers, {
					'accept': 'application/vnd.github.v3.raw',
					'User-Agent': 'jsenv' // https://developer.github.com/changes/2013-04-24-user-agent-required/
				});

				return this.platform.createModuleHttpRequest(giturl, options);
			};
		},

		/*
		live example (only to create, updating would need the SHA)
		author & committer are optional
		var giturl = 'https://api.github.com/repos/dmail/argv/contents/test.js';
		var xhr = new XMLHttpRequest();

		xhr.open('PUT', giturl);
		xhr.setRequestHeader('Authorization', 'token 0b6d30a35dd7eac332909186379673b56e1f03c2');
		xhr.setRequestHeader('content-type', 'application/json');
		xhr.send(JSON.stringify({
			message: 'create test.js',
			content: btoa('Hello world'),
			branch: 'master'
		}));
		*/
		// https://developer.github.com/v3/repos/contents/#create-a-file
		// http://stackoverflow.com/questions/26203603/how-do-i-get-the-sha-parameter-from-github-api-without-downloading-the-whole-f
		createGithubSetter: function(){
			return function(url, body, options){
				var giturl = replace('https://api.github.com/repos/{user}/{repo}/contents/{path}', {

				});

				options.method = 'PUT';
				options.headers = options.headers || {};
				options.body = JSON.stringify({
					message: 'update ' + giturl.pathname,
					content: Base64.encode(body)
				});

				Object.assign(options.headers, {
					'User-Agent': 'jsenv',
					'content-type': 'application/json'
				});

				return this.platform.createModuleHttpRequest(giturl, options);
			};
		},

		// TODO https://developer.github.com/v3/#http-redirects
		createGithubStorage: function(){
			return this.createStorage('github', {
				get: this.createGithubGetter(),
				//set: this.createGithubSetter()
			});
		},

		setupStorages: function(){
			this.httpRequestFactory = this.getHttpRequestFactory();
			this.storages = this.getStorages();

			// httpRequestFactory is equivalent to auto create the http, https & github storages
			if( this.httpRequestFactory ){
				this.storages.push(
					this.createHttpStorage(),
					this.createHttpsStorage(),
					this.createGithubStorage()
				);
			}

			debug('readable storages :', this.storages.reduce(function(previous, storage){
				if( storage.get ) previous.push(storage.name);
				return previous;
			}, []));
			debug('writable storages :', this.storages.reduce(function(previous, storage){
				if( storage.set ) previous.push(storage.name);
				return previous;
			}, []));
		},

		toString: function(){
			return '[Platform ' + this.type + ']';
		},

		getGlobal: function(){
			return undefined;
		},

		getStorages: function(){
			return [];
		},

		getBaseUrl: function(){
			return '';
		},

		getHttpRequestFactory: function(){
			return null;
		},

		createStorage: function(name, options){
			return new Storage(this, name, options);
		},

		findStorage: function(name){
			var i = this.storages.length, storage;
			while(i--){
				storage = this.storages[i];
				if( storage.name === name ) break;
				else storage = null;
			}
			return storage;
		},

		init: function(){
			this.env.init();
		}
	});

	Object.assign(jsenv, {
		platforms: [],
		platform: null,
		globalName: 'jsenv',
		global: null,
		baseURI: null,
		baseUrl: './', // relative to baseURI

		createPlatform: function(type, options){
			return new Platform(this, type, options);
		},

		findPlatform: function(){
			var platforms = this.platforms, i = platforms.length, platform = null;

			while(i--){
				platform = platforms[i];
				if( platform.is.call(this) ){
					break;
				}
				else{
					platform = null;
				}
			}

			return platform;
		}
	});

	var browserPlatform = jsenv.createPlatform('browser', {
		is: function(){
			return typeof window !== 'undefined';
		},

		getSrc: function(){
			return document.scripts[document.scripts.length - 1].src;
		},

		// browser must include script tag with the requirement
		load: function(url, done){
			var script = document.createElement('script');

			script.src = url;
			script.type = 'text/javascript';
			script.onload = function(){
				done();
			};
			script.onerror = function(error){
				done(error);
			};

			document.head.appendChild(script);
		},

		getGlobal: function(){
			return window;
		},

		getAgent: function(){
			var ua = navigator.userAgent.toLowerCase();
			var regex = /(opera|ie|firefox|chrome|version)[\s\/:]([\w\d\.]+)?.*?(safari|version[\s\/:]([\w\d\.]+)|$)/;
			var UA = ua.match(regex) || [null, 'unknown', 0];
			var name = UA[1] == 'version' ? UA[3] : UA[1];
			var version;

			// version
			if( UA[1] == 'ie' && document.documentMode ) version = document.documentMode;
			else if( UA[1] == 'opera' && UA[4] ) version = parseFloat(UA[4]);
			else version = parseFloat(UA[2]);

			return {
				name: name,
				version: version
			};
		},

		getName: function(){
			return this.getAgent().name;
		},

		getVersion: function(){
			return this.getAgent().version;
		},

		getOs: function(){
			return navigator.platform.toLowerCase();
		},

		getBaseUrl: function(){
			var href = window.location.href.split('#')[0].split('?')[0];
			var baseUrl = href.slice(0, href.lastIndexOf('/') + 1);

			return baseUrl;
		},

		createFileStorage: function(){
			return this.createStorage('file', {
				get: function(url, options){
					return this.platform.findStorage('http').get(url, options).then(function(response){
						// fix for browsers returning status == 0 for local file request
						if( response.status === 0 ){
							response.status = response.body ? 200 : 404;
						}
						return response;
					});
				}
			});
		},

		getStorages: function(){
			return [this.createFileStorage()];
		},

		init: function(){
			function ready(){
				var scripts = document.getElementsByTagName('script'), i = 0, j = scripts.length, script;
				for(;i<j;i++){
					script = scripts[i];
					if( script.type === 'module' ){
						jsenv.loader.module(script.innerHTML.slice(1)).catch(function(error){
							setImmediate(function(){ throw error; });
						});
					}
				}

				jsenv.init();
			}

			function completed(){
				document.removeEventListener('DOMContentLoaded', completed);
				window.removeEventListener('load', completed);
				ready();
			}

			if( document.readyState === 'complete' ){
				setTimeout(ready);
			}
			else if( document.addEventListener ){
				document.addEventListener('DOMContentLoaded', completed);
				window.addEventListener('load', completed);
			}
		},

		getHttpRequestFactory: function(){
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


			function createRequest(url, options){
				return new Promise(function(resolve, reject){
					var xhr = new XMLHttpRequest();

					xhr.open(options.method, url);
					if( options.headers ){
						for(var key in options.headers){
							xhr.setRequestHeader(key, options.headers[key]);
						}
					}

					xhr.onerror = reject;
					xhr.onreadystatechange = function(){
						if( xhr.readyState === 4 ){
							resolve({
								status: xhr.status,
								body: xhr.responseText,
								headers: parseHeaders(xhr.getAllResponseHeaders())
							});
						}
					};
					xhr.send(options.body || null);
				});
			}

			return createRequest;
		}
	});
	jsenv.platforms.push(browserPlatform);

	var processPlatform = jsenv.createPlatform('process', {
		is: function(){
			return typeof process !== 'undefined';
		},

		getSrc: function(){
			var src = 'file://' + __filename;

			if( process.platform.match(/^win/) ){
				src = src.replace(/\\/g, '/');
			}

			return src;
		},

		// in node env requires it
		load: function(url, done){
			var error = null;

			if( url.indexOf('file://') === 0 ){
				url = url.slice('file://'.length);
			}

			try{
				require(url);
			}
			catch(e){
				error = e;
			}

			done(error);
		},

		getName: function(){
			return 'node';
		},

		getVersion: function(){
			return process.version;
		},

		getOs: function(){
			// https://nodejs.org/api/process.html#process_process_platform
			// 'darwin', 'freebsd', 'linux', 'sunos', 'win32'
			return process.platform;
		},

		getGlobal: function(){
			return global;
		},

		getBaseUrl: function(){
			var baseUrl = 'file://' + process.cwd() + '/';

			if( process.platform.match(/^win/) ){
				baseUrl = baseUrl.replace(/\\/g, '/');
			}

			return baseUrl;
		},

		createFileStorage: function(){
			var filesystem = require('./utils/filesystem');

			function readFile(file){
				return filesystem('readFile', file);
			}

			function writeFile(file, content){
				return filesystem('writeFile', file, content);
			}

			return this.createStorage('file', {
				get: function(url, options){
					url = String(url).slice('file://'.length);

					return readFile(url).then(function(content){
						return filesystem('stat', url).then(function(stat){
							if( options && options.mtime && stat.mtime <= options.mtime ){
								return {
									status: 302,
									mtime: stat.mtime
								};
							}
							return {
								status: 200,
								body: content,
								mtime: stat.mtime
							};
						});
					}).catch(function(error){
						if( error && error.code == 'ENOENT' ){
							return {
								status: 404
							};
						}
						return {
							status: 500,
							body: error
						};
					});
				},

				set: function(url, body, options){
					url = String(url).slice('file://'.length);
					// writeFile doit faire un mkdir-to

					var mkdirto = require('./utils/mkdir-to');

					return mkdirto(url).then(function(){
						return writeFile(url, body);
					});
				}
			});
		},

		getStorages: function(){
			return [this.createFileStorage()];
		},

		getHttpRequestFactory: function(){
			var http = require('http');
			var https = require('https');
			var parse = require('url').parse;

			function createRequest(url, options){
				var parsed = parse(url), secure;

				Object.assign(options, parsed);

				secure = options.protocol === 'https:';

				options.port = secure ? 443 : 80;

				return new Promise(function(resolve, reject){
					var httpRequest = (secure ? https : http).request(options);

					console.log(options.method, url);

					function resolveWithHttpResponse(httpResponse){
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
						httpResponse.addListener('error', reject);
					}

					httpRequest.addListener('response', resolveWithHttpResponse);
					httpRequest.addListener('error', reject);
					httpRequest.addListener('timeout', reject);
					httpRequest.addListener('close', reject);

					if( options.body ){
						httpRequest.write(options.body);
					}
					else{
						httpRequest.end();
					}

					// timeout
					setTimeout(function(){ reject(new Error("Timeout")); }, 20000);
				});
			}

			return createRequest;
		}
	});
	jsenv.platforms.push(processPlatform);

	// configs
	Object.assign(jsenv, {
		mainModule: 'index',

		include: function(normalizedName, options){
			normalizedName = String(normalizedName);

			var module = this.loader.createModule(normalizedName);

			// prevent locate()
			if( options && options.address ){
				module.address = options.address;
			}

			return module.then(function(){
				module.parse();
				module.execute();
				return module;
			});
		},

		sourceLinks: [],
		originLinks: [],

		link: function(from, to, main, fromType){
			var list = this[fromType === 'source' ? 'sourceLinks' : 'originLinks'];

			list.push({
				from: from,
				to: to,
				type: main ? 'directory' : 'file'
			});

			if( main ){
				list.push({
					from: to,
					to: to + '/' + main,
					type: 'file'
				});
			}
		},

		linkSource: function(from, to, main){
			return this.link(from, to, main, 'source');
		},

		linkOrigin: function(from, to, main){
			return this.link(from, to, main, 'origin');
		},

		isInside: function(path, potentialParent){
			function stripLastSep(path){
				if( path[path.length - 1] === '/' ){
					path = path.slice(0, -1);
				}
				return path;
			}

			path = stripLastSep(path);
			potentialParent = stripLastSep(potentialParent);

			// they are the same
			if( path === potentialParent ) return true;
			// 'folder2' not inside 'folder'
			if( path[potentialParent.length] != '/' ) return false;
			// 'folder/file.js' starts with 'folder'
			return path.indexOf(potentialParent) === 0;
		},

		follow: function(from, fromType){
			if( fromType === 'origin' ) from = this.follow(from, 'source');

			var current = from, to = from;

			this[fromType === 'source' ? 'sourceLinks' : 'originLinks'].forEach(function(link){
				//debug('is there a link for', current, this.isInside(current, link.from));

				if( link.type === 'file' ){
					if( current === link.from ){
						to = link.to;
						debug('follow', fromType, 'link from', current, 'to', to);
						current = to;
					}
				}
				else if( link.type === 'directory' ){
					if( this.isInside(current, link.from) ){
						to = link.to + current.slice(link.from.length);
						debug('follow', fromType, 'link from', current, 'to', to);
						current = to;
					}
				}
			}, this);

			return to;
		},

		rules: [],

		getRule: function(selector){
			var rules = this.rules, i = 0, j = rules.length, rule;

			for(;i<j;i++){
				rule = rules[i];
				if( rule.selector === selector ) break;
				else rule = null;
			}

			return rule;
		},

		rule: function(selector, properties){
			var rule = this.getRule(selector);

			if( rule ){
				Object.assign(rule.properties, properties);
			}
			else{
				this.rules.push({
					selector: selector,
					properties: properties
				});
				// keep rules sorted (the most specific rule is the last applied)
				this.rules = this.rules.sort(function(a, b){
					return (a.selector ? a.selector.length : 0) - (b.selector ? b.selector.length : 0);
				});
			}
		},

		matchSelector: function(name, selector){
			return name === selector;
		},

		findMeta: function(normalizedName){
			var source, meta, match, selector, properties, origin;

			source = normalizedName;
			source = this.follow(source, 'source');
			origin = this.follow(source, 'origin');

			meta = {
				source: source,
				origin: origin
			};

			this.rules.forEach(function(rule){
				selector = rule.selector;
				match = this.matchSelector(source, selector);
				if( match ){
					properties = rule.properties;
					Object.assign(meta, properties);
				}
			}, this);

			return meta;
		}
	});

	// loader
	Object.assign(jsenv, {
		createLoader: function(options){
			return new this.Loader(this, options);
		},

		createJSLoader: function(){
			return this.createLoader({
				extension: '.js',
				baseURL: new URI(this.baseURL, this.baseURI),

				collectDependencies: (function(){
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

					var reDependency = /(?:^|;|\s+|ENV\.)include\(['"]([^'"]+)['"]\)/gm;
					// for the moment remove regex for static ENV.include(), it's just an improvment but
					// not required at all + it's strange for a dynamic ENV.include to be preloaded
					reDependency = /(?:^|;|\s+)include\(['"]([^'"]+)['"]\)/gm;
					function collectIncludeCalls(str){
						str = stripLineComment(stripBlockComment(str));

						var calls = [], match;
						while(match = reDependency.exec(str) ){
							calls.push(match[1]);
						}
						reDependency.lastIndex = 0;

						return calls;
					}

					return function collectDependencies(module){
						return collectIncludeCalls(module.source);
					};
				})(),

				eval: function(code, url){
					if( url ){
						url = String(url);
						if( url.indexOf('file:/') === 0 ){
							url = url.slice('file:/'.length);
						}
						code+= '\n//# sourceURL=' + url;

					}
					return eval(code);
				},

				parse: function(module){
					return this.eval('(function(module, include){\n\n' + module.source + '\n\n});', module.address);
				},

				execute: function(module){
					return module.parsed.call(this.global, module, module.include.bind(module));
				}
			});
		},

		setupLoader: function(){
			this.loader = this.createJSLoader();
		}
	});

	Object.assign(jsenv, {
		setup: function(){
			this.platform = this.findPlatform();
			if( this.platform == null ){
				throw new Error('your javascript environment in not supported');
			}
			this.platform.setup();

			this.global = this.platform.global;
			this.global[this.globalName] = this;
			this.baseURI = this.platform.baseURL;

			this.state = 'loading';
			this.loadRequirements();
		},

		// called when all requirements are loaded
		onload: function(){
			this.state = 'loaded';
			this.setupLoader();
			this.platform.setupStorages();
			this.platform.init();
		},

		// called when jsenv is ready
		init: function(){
			if( this.mainModule ){
				debug('including the mainModule', this.mainModule);

				var main = this.main = this.loader.createModule(
					/*this.loader.normalize(*/this.mainModule//)
				);

				main.then(function(){
					main.parse();
					main.execute();
				}).catch(function(error){
					setImmediate(function(){
						throw error;
					});
				});
			}
		}
	});

	var polyfills = [
		'URI',
		'setImmediate', // because required by promise
		'Symbol', // because required by iterator
		'Iterator', // because required by promise.all
		'Promise' // because it's amazing
		//'System'
	];
	polyfills.forEach(function(polyfillName, index){
		jsenv.need({
			path: '/requirements/' + polyfillName + '.js',

			has: function(){
				return polyfillName in jsenv.global;
			},

			onResolve: function(){
				if( !this.has() ){
					throw new Error('loading the file ' + this.path + 'did not provide ' + polyfillName);
				}
			}
		});
	});
	jsenv.need('/requirements/Base64.js');
	jsenv.need('/requirements/loader.js');
	jsenv.need('/requirements/global.env.js');
	jsenv.need('./project.env.js');

	jsenv.setup();
})();