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

function hasFile(file){
	return filesystem('stat', file).then(function(stat){
		return stat.isFile();
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

function createDirectoriesTo(location){
	var directories = location.split('/');

	directories.pop();

	return directories.reduce(function(previous, directory, index){
		var directoryLocation = directories.slice(0, index + 1).join('/');

		return previous.then(function(){
			return createDirectory(directoryLocation);
		});
	}, Promise.resolve());
}

function cloneRepository(dir, repositoryUrl){
	debug('cd', dir, '& git clone', repositoryUrl);

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

function lstat(location){
	return filesystem('lstat', location);
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
		// the file or folder exists, not supposed to happen
		else{
			throw new Error(destination, 'exists, please delete this');
		}
	// create directories leading to the symlink
	}).catch(function(error){
		if( error && error.code == 'ENOENT' ){
			return createDirectoriesTo(destination);
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

/*
Par défaut tous les modules externes (http & git) sont mit dans le dossier parent modules
pour éviter qu'on les cherche et on les symlink

la logique ou on cherche le module à cet endroit et on le symlink sors de la fonction clonerepo

IMPORTANT : par défaut un module externe est FORCEMENT dans un dossier
il n'est pas possible de dépendre de fichier externe pour le moment

le comportement par défaut devrait être de pouvoir dépendre d'un fichier
et git & file fonctionne différrement en disant de tester la présence du dossier et non du fichier
*/

var protocols = {
	'git+https': {
		base: '../modules',

		getProjectName: function(name){
			return path.dirname(name.slice('file://'.length));
		},

		getLocalName: function(projectName){
			var base = ENV.baseUrl.slice('file://'.length);
			base = path.resolve(this.base, base);

			var relativeName = path.relative(base, projectName);
			var localName = path.dirname(base) + '/' + relativeName;

			return localName;
		},

		fetch: function(localName, giturl){
			return hasDirectory(localName).then(function(has){
				if( has ) return;
				return cloneRepository(path.dirname(localName), giturl.slice('git+'.length));
			});
		}
	}
};

/*
protocols.file = {
	getProjectName: function(name){
		return name.slice('file://'.length);
	},

	getLocalName: function(name){
		return name;
	},

	fetch: function(localName, fileName){
		return symlink(localName, fileName);
	}
}

http & https should target a zip
protocols.http = protocols.https = function(directory, url){

};
*/

function fetchOrigin(module){
	var origin = ENV.parseURI(module.meta.origin);
	var originProtocol = origin.protocol.slice(0, -1);

	if( false === originProtocol in protocols ){
		throw new Error('the origin protocol ' + originProtocol + ' is not supported');
	}

	var protocol = protocols[originProtocol];
	var projectName = protocol.getProjectName(module.location.href);
	var localName = protocol.getLocalName(projectName);
	var originName = origin.href;

	debug('project name', projectName);
	debug('local name: ', localName);
	debug('origin name', originName);

	return protocol.fetch(localName, originName).then(function(){
	// symlink
		return symlink(localName, projectName);
	}).then(function(){
	// now it has been fetched from origin, refetch "locally"
		return ENV.fetch(module);
	});
}

var fetch = ENV.fetch;
ENV.fetch = function(module){
	return fetch.call(this, module).catch(function(error){
		if( error && error.code === 'MODULE_NOT_FOUND' && module.meta.origin && !module.meta.installed ){
			module.meta.installed = true;
			return fetchOrigin(module);
		}
		else{
			return Promise.reject(error);
		}
	}.bind(this));
};

ENV.include(process.argv[2]);