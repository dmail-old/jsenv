/*
au lieu de git clone on pourrait dl l'archive + unzip
(voir https://github.com/kriszyp/nodules/blob/master/lib/nodules-utils/unzip.js)
https://github.com/dmail/argv/zipball/master.zip
https://github.com/dmail/argv/archive/master.zip
*/

var path = require('path');
var envLocation;

try{
	envLocation = require.resolve('env');
}
catch(e){
	throw new Error('Cannot find env, did you npm install -g @dmail/env?');
}

var relative = path.relative(__dirname, envLocation);
var to = process.cwd() + '/modules/env'; // ce /modules/env
var resolved = path.resolve(to, relative);

process.env.ENV_GLOBAL_PATH = envLocation;
process.env.ENV_LOCAL_PATH = resolved;

var cmd = process.argv[2] || 'start';

console.log('requiring the command', cmd);

require('./commands/' + cmd);
