var filesystem = require('./filesystem');
var mkdirto = require('./mkdir-to');

function readFile(file){
	return filesystem('readFile', file);
}

function writeFile(file, content){
	return filesystem('writeFile', file, content);
}

function stripProtocol(url){
	return url.slice('file://'.length);
}

function getRequestUrl(request){
	return stripProtocol(String(request.url));
}

module.exports = {
	createGetPromise: function(request){
		var url = getRequestUrl(request);

		return readFile(url).then(function(content){
			return filesystem('stat', url).then(function(stat){
				if( request.mtime && stat.mtime <= request.mtime ){
					return {
						status: 302,
						mtime: stat.mtime
					};
				}
				return {
					status: 200,
					body: content,
					mtime: stat.mtime
				};
			});
		}).catch(function(error){
			if( error ){
				if( error.code == 'ENOENT' ) return 404;
				// https://iojs.org/api/errors.html#errors_eacces_permission_denied
				if( error.code === 'EACCES' ) return 403;
				if( error.code === 'EPERM' ) return 403;
				// file access may be temporarily blocked (by an antivirus scanning it because recently modified for instance)
				// emfile means there is too many files currently opened
				if( error.code === 'EBUSY' || error.code === 'EMFILE' ){
					return {
						status: 503, // unavailable
						headers: {
							'retry-after': 10 // retry in 10ms
						}
					};
				}

				return {
					status: 500,
					body: error
				};
			}

			return 500;
		});
	},

	createSetPromise: function(request){
		var url = getRequestUrl(request);
		var body = request.body;

		return mkdirto(url).then(function(){
			return writeFile(url, body);
		});
	}
};