var symlink = require('../utils/symlink');
var path = require('path');

var envSource = path.dirname(process.env.ENV_GLOBAL_PATH);
var envDestination = path.dirname(process.env.ENV_LOCAL_PATH);

symlink(envSource, envDestination).catch(function(error){
	console.log(error.stack);
});

// si aucun fichier env.global.js n'existe, le créer?
// si un .gitignore, ajouter modules/ ?