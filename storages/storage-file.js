var fs = require('fs');
var mimetype = require('../utils/mimetype');
var filesystem = require('../utils/filesystem');
var mkdirto = require('../utils/mkdir-to');

function readFile(file){
	return filesystem('readFile', file);
}

function writeFile(file, content){
	return filesystem('writeFile', file, content);
}

function stripFileProtocol(url){
	if( url.indexOf('file://') === 0 ){
		url = url.slice('file://'.length);
	}
	return url;
}

function getRequestUrl(request){
	return stripFileProtocol(String(request.url));
}

function createResponsePromiseForGet(options){
	var url = getRequestUrl(options), promise;

	promise = filesystem('stat', url).then(function(stat){
		// new Date request if modified-since peut échouer, dans ce cas renvoyer 400 bad request
		if( options.headers['if-modified-since'] && stat.mtime <= new Date(options.headers['if-modified-since']) ){
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
				'content-type': mimetype(url),
				'content-length': stat.size
			}
		};
	});

	promise = promise.catch(function(error){
		if( error ){
			if( error.code == 'ENOENT' ){
				return {
					status: 404
				};
			}
			// https://iojs.org/api/errors.html#errors_eacces_permission_denied
			if( error.code === 'EACCES' ){
				return {
					status: 403
				};
			}
			if( error.code === 'EPERM' ){
				return {
					status: 403
				};
			}
			// file access may be temporarily blocked (by an antivirus scanning it because recently modified for instance)
			if( error.code === 'EBUSY' ){
				return {
					status: 503,
					headers: {
						'retry-after': 0.010 // retry in 10ms
					}
				};
			}
			// emfile means there is too many files currently opened
			if( error.code === 'EMFILE' ){
				return {
					status: 503,
					headers: {
						'retry-after': 0.1 // retry in 100ms
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

		return {
			status: 500
		};
	});

	return promise;
}

function createResponsePromiseForSet(options){
	var url = getRequestUrl(options);
	var body = options.body;
	var promise;

	promise = mkdirto(url).then(function(){
		return writeFile(url, body).then(function(){
			return 200;
		});
	});

	return promise;
}

module.exports = {
	url: {
		protocol: 'file'
	},

	createGetPromise: function(options){
		return this.store.env.http.createResponsePromise(createResponsePromiseForGet, options);
	},

	createSetPromise: function(options){
		return this.store.env.http.createResponsePromise(createResponsePromiseForSet, options);
	}
};