var symlink = require('../utils/symlink');
var path = require('path');
var fs = require('fs');

var jsenvGlobalFolder = path.dirname(process.env.JSENV_GLOBAL_PATH);
var jsenvProjectFolder = path.dirname(process.env.JSENV_PROJECT_PATH);
var globalProjectFolder = jsenvGlobalFolder + '/project';
var projectFolder = process.cwd();

// if modules/jsenv exists that's great, else we symlink it to the global env
if( !fs.lstatSync(jsenvProjectFolder).isDirectory() ){
	symlink(jsenvGlobalFolder, jsenvProjectFolder).catch(function(error){
		console.log(error.stack);
	});
}

// create the project model files
fs.readdirSync(globalProjectFolder).map(function(name){
	return globalProjectFolder + '/' + name;
}).forEach(function(globalProjectFile){
	var basename = path.basename(globalProjectFile);
	var projectFile = projectFolder + '/' + basename;

	if( !fs.existsSync(projectFile) ){
		fs.writeFileSync(projectFile, fs.readFileSync(globalProjectFile));
	}
});

// si un .gitignore, ajouter modules/ ?