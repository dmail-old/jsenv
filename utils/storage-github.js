var base64 = require('./Base64.js');

function replace(string, values){
	return string.replace((/\\?\{([^{}]+)\}/g), function(match, name){
		if( match.charAt(0) == '\\' ) return match.slice(1);
		return (values[name] != null) ? values[name] : '';
	});
}

/*
live example
var giturl = 'https://api.github.com/repos/dmail/argv/contents/index.js?ref=master';
var xhr = new XMLHttpRequest();
var date = new Date();
date.setMonth(0);

xhr.open('GET', giturl);
xhr.setRequestHeader('accept', 'application/vnd.github.v3.raw');
xhr.setRequestHeader('if-modified-since', date.toUTCString());
xhr.send(null);
*/
function completeGithubGetRequestOptions(options){
	var url = options.url;
	var parsed = new URL(url);
	var pathname = parsed.pathname;
	var parts = pathname.slice(1).split('/');
	var user = pathname[0];
	var repo = pathname[1];
	var file = pathname.slice(2);

	var giturl = replace('https://api.github.com/repos/{user}/{repo}/contents/{path}?ref={version}', {
		user: user,
		repo: repo,
		path: file || 'index.js',
		version: parsed.hash ? parsed.hash.slice(1) : 'master'
	});

	Object.complete(options, {
		headers: {
			'accept': 'application/vnd.github.v3.raw',
			'User-Agent': 'jsenv' // https://developer.github.com/changes/2013-04-24-user-agent-required/
		}
	});

	options.url = giturl;

	return options;
}

/*
live example (only to create, updating need the SHA)
author & committer are optional
var giturl = 'https://api.github.com/repos/dmail/argv/contents/test.js';
var xhr = new XMLHttpRequest();

xhr.open('PUT', giturl);
xhr.setRequestHeader('Authorization', 'token 0b6d30a35dd7eac332909186379673b56e1f03c2');
xhr.setRequestHeader('content-type', 'application/json');
xhr.send(JSON.stringify({
	message: 'create test.js',
	content: btoa('Hello world'),
	branch: 'master'
}));
*/
// https://developer.github.com/v3/repos/contents/#create-a-file
// http://stackoverflow.com/questions/26203603/how-do-i-get-the-sha-parameter-from-github-api-without-downloading-the-whole-f
// en mode install il suffit de faire un create file avec PUT
// en mode update il faut update le fichier avec un PUT mais c'est plus complexe
function completeGithubSetRequestOptions(request){
	var giturl = replace('https://api.github.com/repos/{user}/{repo}/contents/{path}', {

	});

	Object.complete(request, {
		method: 'PUT',
		headers: {
			'content-type': 'application/json',
			'User-Agent': 'jsenv'
		},
		body: JSON.stringify({
			message: 'update ' + giturl.pathname,
			content: Base64.encode(request.body)
		})
	});

	request.url = giturl;

	return request;
}

module.exports = {
	createGetPromise: function(options){
		options = completeGithubGetRequestOptions(options);

		return this.createResponsePromiseFromRequest(this.env.http.createRequest(options));
	},

	createSetPromise: function(options){
		options = completeGithubSetRequestOptions(options);

		return this.createResponsePromiseFromRequest(this.env.http.createRequest(options));
	}
};