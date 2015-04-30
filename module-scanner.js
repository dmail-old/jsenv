// https://github.com/jonschlinkert/strip-comments/blob/master/index.js
var reLine = /(^|[^\S\n])(?:\/\/)([\s\S]+?)$/gm;
var reLineIgnore = /(^|[^\S\n])(?:\/\/[^!])([\s\S]+?)$/gm;
function stripLineComment(str, safe){
	return String(str).replace(safe ? reLineIgnore : reLine, '');
}

var reBlock = /\/\*(?!\/)(.|[\r\n]|\n)+?\*\/\n?\n?/gm;
var reBlockIgnore = /\/\*(?!(\*?\/|\*?\!))(.|[\r\n]|\n)+?\*\/\n?\n?/gm;
function stripBlockComment(str, safe){
	return String(str).replace(safe ? reBlockIgnore : reBlock, '');
}

//https://github.com/jonschlinkert/requires-regex/blob/master/index.js
var reRequire = /^[ \t]*(var[ \t]*([\w$]+)[ \t]*=[ \t]*)?require\(['"]([\w\W]+?)['"]\)/gm;
function matchRequires(str, keepComments){
	if( !keepComments ){
		str = stripLineComment(stripBlockComment(str));
	}

	var lines = str.split('\n'), len = lines.length, i = 0, requires = [], match, line;

	while(len--){
		line = lines[i++];
		match = reRequire.exec(line);
		if( match ){
			requires.push({
				line: i,
				variable: match[2] || '',
				module: match[3],
				original: line
			});
		}
	}

	return requires;
}

module.exports = {
	scan: matchRequires
};