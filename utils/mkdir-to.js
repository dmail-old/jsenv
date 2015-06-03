var filesystem = require('./filesystem');

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
	var directories = location.replace(/\\/g, '/').split('/');

	directories.pop();

	return directories.reduce(function(previous, directory, index){
		var directoryLocation = directories.slice(0, index + 1).join('/');

		return previous.then(function(){
			return createDirectory(directoryLocation);
		});
	}, Promise.resolve());
}

module.exports = createDirectoriesTo;