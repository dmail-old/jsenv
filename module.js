/*

inspiration:
https://github.com/joyent/node/blob/master/lib/module.js
https://github.com/joyent/node/blob/master/src/node.js
http://fredkschott.com/post/2014/06/require-and-the-module-system/?utm_source=nodeweekly&utm_medium=email

*/

var moduleScanner, moduleResolver, Ajax, Promise;

var Module = {
	filename: null, // resolved filename
	cache: {},
	resolvedPaths: null, // contain path already resolved to filenames for this module
	dependencies: null, // module required by this one
	dependents: null, // module requiring this one

	source: null, // module source as string
	fn: null, // the module method
	exports: null, // the value returned by module.fn()

	name: null, // it's not unique because of version
	vesion: null,
	meta: null,

	constructor: function(filename){
		if( filename in this.cache ){
			return this.cache[filename];
		}

		this.filename = filename;
		this.cache[filename] = this;
		this.resolvedPaths = {};

		this.dependencies = [];
		this.dependents = [];
	},

	addDependency: function(filename){
		var module = new Module(filename);

		this.dependencies.push(module);
		module.dependents.push(this);

		return module;
	},

	get dirname(){
		var path = this.filename, lastSlash;

		if( path.length > 1 && path[path.length - 1] == '/' ) path = path.replace(/\/+$/, '');

		lastSlash = path.lastIndexOf('/');
		switch(lastSlash){
		case -1:
			return '.';
		case 0:
			return '/';
		default:
			return path.substring(0, lastSlash);
		}
	},

	_resolve: function(){ throw new Error(); },
	_load: function(){ throw new Error(); },
	_eval: function(){ throw new Error(); },

	load: function(){
		var promise;

		if( this.hasOwnProperty('source') ){
			promise = Promise.resolve(this.source);
		}
		else{
			promise = this._load(this.filename);
			promise = promise.then(function(source){
				return this.source = source;
			}.bind(this));
		}

		return promise;
	},

	scan: function(){
		var dependencyNames;

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

	resolve: function(path){
		var promise;

		if( path in this.resolvedPaths ){
			promise = Promise.resolve(this.resolvedPaths[path]);
		}
		else{
			promise = this._resolve(path, this.filename);
			promise = promise.then(function(resolvedPath){
				this.resolvedPaths[path] = resolvedPath;
			}.bind(this));
		}

		return promise;
	},

	createDependencies: function(){
		return Promise.map(this.dependencyNames, this.resolve, this).then(function(dependencyPaths){
			dependencyPaths.map(this.addDependency, this);
		}.bind(this));
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
		], null, this);
	},

	compile: function(){
		var code, fn;

		code = '(function(module){\n\n' + this.source + '\n\n})';

		try{
			fn = this._eval(code, this.filename);
		}
		catch(e){
			// syntax/reference error in module source
			throw e;
		}

		return this.fn = fn;
	},

	exec: function(){
		var result;

		try{
			result = this.fn.call(this, this);
		}
		catch(e){
			// execution of the module code raise an error
			throw e;
		}

		return this.exports = result;
	},

	start: function(){
		// dès que le module est prêt on peut l'éxécuter
		return this.ready().then(function(){
			this.compile();
			return this.exec();
		}.bind(this));
	},

	// les modules requis ont déjà été chargé, il ne reste qu'à les compile+exec
	// et à retourner le résultat
	// c'est ce qu'on fait ici
	require: function(){

	}
};

/*

il suffit de faire node module module-a

cherche où se trouve module-a depuis le module courant (working directory)
une fois trouvé, charge le
une fois chargé, scan les dépendances
*/

var rootScope, mainModulePath;

Module._eval = function(code, filename){
	code+= '\n//# sourceURL=' + filename;
	return window.eval(code);
};

if( typeof window !== 'undefined' ){
	rootScope = window;
	mainModulePath = '.' + window.location.pathname;

	Module._resolve = function(what, where){
		var url = 'resolve?where={where}&what={what}';

		url = url.replace('{where}', encodeURIComponent(where));
		url = url.replace('{what}', encodeURIComponent(what));
		url = window.location.origin + '/' + url;

		return Promise.resolve(new Ajax({
			method: 'get',
			url: url
		}));
	};

	Module._load = function(path){
		var url = 'resolve?path={path}';

		url = url.replace('{path}', encodeURIComponent(path));
		url = window.location.origin + '/' + url;

		return Promise.resolve(new Ajax({
			method: 'get',
			url: url
		}));
	};
}
else{
	rootScope = global;
	mainModulePath = process.cwd();

	Module._resolve = function(what, where){
		var resolver = moduleResolver.create(where, what);
		return resolver.resolve();
	};

	Module._load = function(){

	};
}

Module.constructor.prototype = Module;
Module = Module.constructor;

// main module ou rootModule
var module = new Module(mainModulePath);