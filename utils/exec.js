var child_process = require('child_process');

function exec(){
	var args = Array.prototype.slice.call(arguments);

	return new Promise(function(resolve, reject){
		args.push(function(error, stdout, stderr){
			if( error ) reject(error);
			else resolve(stdout || stderr);
		});

		child_process.exec.apply(child_process, args);
	});
}

module.exports = exec;