var mkdirto = require('./mkdir-to');
var fs = require('fs');
var path = require('path');
var child_process = require('child_process');

function cloneRepository(url, directory){
	directory = path.dirname(directory);
	console.log('git clone', url, 'into', directory);

	return new Promise(function(resolve, reject){
		child_process.exec('git clone ' + url, {cwd: directory}, function(error, stdout, stderr){
			if( error ) reject(error);
			else resolve(stdout || stderr);
		});
	});
}

module.exports = function(repositoryURL, directory){
	directory = String(directory);

	return mkdirto(directory).then(function(){
		return cloneRepository(repositoryURL, directory);
	});
};

