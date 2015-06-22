var fs = require('fs');
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

var FakeFileHttpGetRequest = jsenv.http.extendRequest(function(){
	var request = this, url = getRequestUrl(this), promise;

	promise = filesystem('stat', url).then(function(stat){
		// new Date request if modified-since peut échouer, dans ce cas renvoyer 400 bad request
		if( request.headers['if-modified-since'] && stat.mtime <= new Date(request.headers['if-modified-since']) ){
			return {
				status: 302,
				headers: {
					'last-modified': stat.mtime.toUTCString()
				}
			};
		}
		return {
			status: 200,
			headers: {
				'last-modified': stat.mtime.toUTCString(),
				'content-length': stat.size
			}
		};
	});

	promise = promise.catch(function(error){
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
		}
		return Promise.reject(error);
	});

	if( this.method != 'HEAD' ){
		promise = promise.then(function(response){
			response.body = fs.createReadStream(url);
			return response;
		});
	}

	promise = promise.catch(function(error){
		if( error ){
			return {
				status: 500,
				body: error
			};
		}

		return 500;
	});

	return promise;
});

var FakeFileHttpSetRequest = jsenv.http.extendRequest(function(){
	var request = this;
	var url = getRequestUrl(this);
	var body = request.body;
	var promise;

	promise = mkdirto(url).then(function(){
		return writeFile(url, body).then(function(){
			return 200;
		});
	});

	return promise;
});