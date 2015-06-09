var filesystem = require('./utils/filesystem');
var mkdirto = require('./utils/mkdir-to');

function readFile(file){
	return filesystem('readFile', file);
}

function writeFile(file, content){
	return filesystem('writeFile', file, content);
}

jsenv.define('storages', {
	file: {
		get: function(request){
			var url = String(request.url).slice('file://'.length);

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
		},

		set: function(request){
			var url = String(request.url).slice('file://'.length);
			var body = request.body;

			return mkdirto(url).then(function(){
				return writeFile(url, body);
			});
		}
	}
});