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
	return lstat(destination).then(function(stat){
		// check the existing symbolic link
		if( stat.isSymbolicLink() ){
			return filesystem('readlink', destination).then(function(link){
				if( link[link.length -1] == '\\' || link[link.length -1] == '/' ) link = link.slice(0, -1);
				if( link.indexOf('\\') !== -1 ) link = link.replace(/\\/g, '/');

				if( link != source ){
					debug('remove previous link to', link, 'because new link is', source);
					return filesystem('unlink', destination);
				}
				else{
					var error = new Error(destination + 'already linked to ' + source);
					error.code = 'EEXIST';
					throw error;
				}
			});
		}
		// it's a file or a directory, we should rmdirRecursive or unlink file
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
		debug('symlink', source, destination);

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