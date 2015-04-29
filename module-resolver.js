/*
https://github.com/substack/node-resolve/tree/master/lib
http://nodejs.org/api/modules.html#modules_all_together
*/

/*
je vais simplifier le process, les modules sont toujours dans un dossier spécifique
on remonte pas les parents pour trouver où ils sont
*/

require('@dmail/promise/from');
require('@dmail/promise/first');
require('@dmail/promise/mapFirst');
var proto = require('@dmail/proto');
var debug = require('@dmail/debug');
var path = require('path');
var fs = require('fs');

var ModuleLocationResolver = proto.extend({
	moduleFolder: 'node_modules',
	moduleFile: 'index',
	moduleMeta: 'package.json',
	extension: '.js',

	what: null, // search what
	where: null, // from where

	constructor: function(what, where){
		this.what = what;
		this.where = where;
	},

	createNotFoundError: function(){
		var error = new Error('Cannot find module \''+ this.what +'\'');
		error.code = 'MODULE_NOT_FOUND';
		return error;
	},

	isNotFoundError: function(error){
		return error && error.code === 'MODULE_NOT_FOUND';
	},

	loadAsFile: function(filename){
		if( path.extname(filename) != this.extension ){
			filename = filename + this.extension;
		}

		debug('trying to load module at ', filename);

		return Promise.from(function(complete){
			fs.stat(filename, complete);
		}, this).then(
			function(stat){
				// it's a file, return the path
				if( stat.isFile() ){
					debug('module found at', filename);
					return filename;
				}
				// it's something else
				throw this.createNotFoundError();
			}.bind(this),
			function(error){
				// file not found
				if( error.code === 'ENOENT' ){
					// try to find with folder name
					var dirname = path.dirname(filename);
					var dirBasename = path.basename(dirname);
					var basename = path.basename(filename, this.extension);

					if( dirBasename !== basename ){
						return this.loadAsFile(path.join(dirname, dirBasename + this.extension));
					}
					throw this.createNotFoundError();
				}
				return Promise.reject(error);
			}.bind(this)
		);
	},

	loadAsDirectory: function(filename){
		var indexPath = path.join(filename, this.moduleFile);
		return this.loadAsFile(indexPath);
	},

	load: function(filename){
		return Promise.first([
			this.loadAsFile,
			this.loadAsDirectory
		], this, filename, this.isNotFoundError, this);
	},

	// http://nodejs.org/api/modules.html#modules_loading_from_node_modules_folders
	// https://github.com/joyent/node/blob/master/lib/module.js#L202
	collectModulePaths: function(dirname){
		var parts = dirname.split(path.sep), dirs, dir, i, part;

		i = parts.length - 1;
		dirs = [];
		for(;i>=0;i--){
			part = parts[i];

			if( part == this.moduleFolder ) continue;
			dir = parts.slice(0, i + 1).concat(this.moduleFolder).join(path.sep);
			dirs.push(dir);
		}

		return dirs;
	},

	loadModules: function(filename, dirname){
		var dirs = this.collectModulePaths(dirname);

		debug('searching module into directories', dirs);

		if( dirs.length === 0 ) return Promise.reject(this.createNotFoundError());
		return Promise.mapFirst(dirs, function(dir){
			return this.load(path.join(dir, filename));
		}, this, null, this.isNotFoundError, this);
	},

	resolve: function(){
		var what = this.what;
		var where = this.where;

		// attention il est possible pour relative path et in the filesystem
		// que le nom de module finisse par
		// proto@1.0
		// proto@1.*.0
		// il faut tenir compte de ce @ et chercher une version correspondante normalement
		// pour le moment j'ignore les prob de version

		// relative path
		if( what[0] == '/' || what.slice(0,2) == './' || what.slice(0,3) == '../' ){
			return this.load(path.resolve(where, what));
		}
		// absolute path
		if( what.indexOf('http://') === 0 ){
			return Promise.resolve(what);
		}
		if( what.indexOf('https://') === 0 ){
			return Promise.resolve(what);
		}
		if( what.indexOf('git') === 0 ){
			return Promise.resolve(what);
		}
		// search in the filesystem
		return this.loadModules(what, path.dirname(where));
	}
});

module.exports = ModuleLocationResolver;
