var filesystem = require('./filesystem');
var createDirectoriesTo = require('./mkdir-to');

function debug(){
	var args = Array.prototype.slice.call(arguments);
	console.log.apply(console, args);
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
			throw new Error(destination + 'exists, please delete this');
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

module.exports = symlink;