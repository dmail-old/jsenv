/*
'git+https://github.com/dmail/*.git'
-> git clone dans un dossier parent + symlink là où il doit être
'file://../modules/test'
-> symlink
'https://raw.githubusercontent.com/dmail/argv/master/index.js'
-> http get request to get the file

au lieu de git clone on pourrait dl l'archive + unzip
(voir https://github.com/kriszyp/nodules/blob/master/lib/nodules-utils/unzip.js)
https://github.com/dmail/argv/zipball/master.zip
https://github.com/dmail/argv/archive/master.zip


var filename = ENV.normalize('index', null, ENV.baseUrl);
var module = ENV.createModule(filename);

// je fetch, translate, collectDependencies de ce module, puis je load les dépendences
module.fetch().then(function(){

});
*/

require('./env');

function debug(){
	var args = Array.prototype.slice.call(arguments);
	console.log.apply(console, args);
}

var child_process = require('child_process');
var path = require('path');
var fs = require('fs');

function filesystem(method){
	var args = Array.prototype.slice.call(arguments, 1);

	return new Promise(function(resolve, reject){
		args.push(function(error, result){
			if( error ){
				reject(error);
			}
			else{
				resolve(result);
			}
		});

		fs[method].apply(fs, args);
	});
}

function hasDirectory(dir){
	return filesystem('stat', dir).then(function(stat){
		return stat.isDirectory();
	}).catch(function(error){
		if( error && error.code == 'ENOENT' ) return false;
		return Promise.reject(error);
	});
}

function createDirectory(dir){
	return hasDirectory(dir).then(function(has){
		if( has ) return;
		console.log('create directory', dir);
		return filesystem('mkdir', dir);
	});
}

function createDirectoriesTo(dir){
	var directories = dir.split('/');

	return directories.reduce(function(previous, directory, index){
		var directoryLocation = directories.slice(0, index + 1).join('/');

		return previous.then(function(){
			return createDirectory(directoryLocation);
		});
	}, Promise.resolve());
}

function cloneRepository(dir, repositoryUrl){
	debug('cd', dir, 'git clone', repositoryUrl);

	return new Promise(function(resolve, reject){
		child_process.exec('git clone ' + repositoryUrl, {
			cwd: dir
		}, function(error, stdout, stderr){
			if( error ){
				reject(error);
			}
			else{
				console.log(stdout || stderr);
				resolve();
			}
		});
	});
}

function lstat(dir){
	return filesystem('lstat', dir);
}

function symlink(source, destination){
	debug('symlink', source, destination);

	return lstat(destination).then(function(stat){
		// check the existing symbolic link
		if( stat.isSymbolicLink() ){
			return filesystem('readlink', destination).then(function(link){
				if( link != destination ){
					debug('remove previous link to', destination);
					return filesystem('unlink', destination);
				}
				else{
					var error = new Error(destination + 'already linked to ' + source);
					error.code = 'EEXIST';
					throw error;
				}
			});
		}
		// a folder exists, but this folder does not contain
		// the desired module, not supposed to happen
		else{
			throw new Error(destination, 'exists, please delete it');
		}
	// create directories leading to the symlink
	}).catch(function(error){
		if( error && error.code == 'ENOENT' ){
			return createDirectoriesTo(path.dirname(destination));
		}
		return Promise.reject(error);
	// do symlink
	}).then(function(){
		return filesystem('symlink', source, destination, 'junction');
	// eexist is not an error
	}).catch(function(error){
		if( error && error.code === 'EEXIST'){
			return null;
		}
		return Promise.reject(error);
	});
}

var repositories = {};

function git(module){
	var location = module.location.href.slice('file://'.length);
	var base = ENV.baseUrl.slice('file://'.length);

	var relativeModuleLocation = path.relative(base, location);
	var localModule = path.dirname(base) + '/' + relativeModuleLocation;
	var localModuleDirectory = path.dirname(localModule);
	var localModuleFolder = path.dirname(localModuleDirectory);
	var projectModule = location;
	var projectModuleDirectory = path.dirname(location);
	var projectModuleFolder = path.dirname(projectModuleDirectory);
	var giturl = module.meta.repository;

	console.log('local module location: ', localModule);
	console.log('project module location', projectModule);
	console.log('git module location', giturl);

	return hasDirectory(localModuleDirectory).then(function(has){
		if( has ){
			debug(module, 'has local directory');
			return symlink(localModuleDirectory, projectModuleDirectory);
		}
		else{
			return createDirectoriesTo(localModuleFolder).then(function(){
				return cloneRepository(localModuleFolder, giturl);
			}).then(function(){
				return symlink(localModuleDirectory, projectModuleDirectory);
			});
		}
	}).then(function(){
		return ENV.fetch(module);
	});
}

var fetch = ENV.fetch;
ENV.fetch = function(module){
	return fetch.call(this, module).catch(function(error){
		if( error && error.code === 'MODULE_NOT_FOUND' && module.meta.registry && !module.meta.installed ){
			module.meta.installed = true;

			var registry = ENV.parseURI(module.meta.registry);
			var location = module.location;
			var protocol = registry.protocol.slice(1);

			// git clone + symlink
			if( protocol === 'git+https' ){
				return git(module);
			}
			// download the file + save it on filesystem
			else if( protocol === 'http' || protocol === 'https' ){
				module.location = registry;
				return ENV.fetch(module).then(function(source){
					module.location = location;
					module.source = source;
					// écrit le fichier sur le filesystem
					return filesystem('writeFile', module.address.slice('file://'.length), source);
				}).then(function(){
					return module.source;
				});
			}
			// symlink the local file
			else if( protocol === 'file' ){
				return symlink(registry.href, location.href).then(function(){
					return ENV.fetch(module);
				});
			}
			else{
				throw new Error('the registry ' + protocol + ' is not supported');
			}
		}
		else{
			return Promise.reject(error);
		}
	}.bind(this));
};

ENV.include(process.argv[2]);