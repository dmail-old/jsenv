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

/*
var child_process = require('child_process');

var path = require('path');
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
*/

module.exports = filesystem;