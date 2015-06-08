/*
au lieu de git clone on pourrait dl l'archive + unzip
(voir https://github.com/kriszyp/nodules/blob/master/lib/nodules-utils/unzip.js)
https://github.com/dmail/argv/zipball/master.zip
https://github.com/dmail/argv/archive/master.zip
*/

var path = require('path');
var envLocation;
var envName = JSON.parse(require('fs').readFileSync(__dirname + '/package.json')).name;

try{
	envLocation = require.resolve(envName);
}
catch(e){
	throw new Error('Cannot find env, did you npm install -g @dmail/env?');
}

var relative = path.relative(__dirname, envLocation);
var to = process.cwd() + '/modules/' + envName; // ce /modules/ devrait être configurable non?
var resolved = path.resolve(to, relative);

process.env.JSENV_GLOBAL_PATH = envLocation;
process.env.JSENV_PROJECT_PATH = resolved;

var cmd = process.argv[2] || 'start';

try{
	require('./utils/commands/' + cmd);
}
catch(e){
	if( e.code === 'MODULE_NOT_FOUND' ){
		throw new Error('The command ' + cmd + ' does not exists');
	}
	throw e;
}
