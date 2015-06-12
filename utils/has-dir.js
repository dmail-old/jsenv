var filesystem = require('./filesystem');

function hasDirectory(dir){
	return filesystem('stat', dir).then(function(stat){
		return stat.isDirectory();
	}).catch(function(error){
		if( error && error.code == 'ENOENT' ) return false;
		return Promise.reject(error);
	});
}

module.exports = hasDirectory;