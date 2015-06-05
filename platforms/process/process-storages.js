var filesystem = require('./utils/filesystem');
var mkdirto = require('./utils/mkdir-to');

function readFile(file){
	return filesystem('readFile', file);
}

function writeFile(file, content){
	return filesystem('writeFile', file, content);
}

function createGetter(url, options){
	url = String(url).slice('file://'.length);

	return readFile(url).then(function(content){
		return filesystem('stat', url).then(function(stat){
			if( options && options.mtime && stat.mtime <= options.mtime ){
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
			if( error.code == 'ENOENT' ){
				return {
					status: 404
				};
			}
			// file access may be temporarily blocked, for instance by an antivirus scanning it
			// because it was recently modified
			if( error.code === 'EBUSY' ){
				return {
					status: 503, // unavailable
					headers: {
						'retry-after': 10 // retry in 10ms
					}
				};
			}
		}
		return {
			status: 500,
			body: error
		};
	});
}

jsenv.platform.register('storages', {
	file: {
		get: function(url, options){
			return createGetter(url, options);
		},

		set: function(url, body, options){
			url = String(url).slice('file://'.length);

			return mkdirto(url).then(function(){
				return writeFile(url, body);
			});
		}
	}
});