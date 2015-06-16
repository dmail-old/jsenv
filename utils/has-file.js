var filesystem = require('./filesystem');

function hasFile(location){
	return filesystem('stat', location).then(function(stat){
		return stat.isFile();
	}).catch(function(error){
		if( error && error.code == 'ENOENT' ) return false;
		return Promise.reject(error);
	});
}

module.exports = hasFile;