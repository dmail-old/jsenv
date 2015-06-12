var mkdirto = require('./mkdir-to');
var exec = require('./exec');
var path = require('path');

module.exports = function(repositoryURL, directory){
	directory = String(directory);

	return mkdirto(directory).then(function(){
		directory = path.dirname(directory);

		console.log('git clone', repositoryURL, 'into', directory);
		return exec('git clone' + repositoryURL, {
			cwd: directory
		});
	});
};

