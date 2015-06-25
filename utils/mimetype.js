var path = require('path');

var defaultMimetype = "application/octet-stream";
var mimetypes = {
	// text
	"txt": "text/plain",
	"html": "text/html",
	"css": "text/css",
	"appcache": "text/cache-manifest",
	// application
	"js": "application/javascript",
	"json": "application/json",
	"xml": "application/xml",
	"gz": "application/x-gzip",
	"zip": "application/zip",
	"pdf": "application/pdf",
	// image
	"png": "image/png",
	"gif": "image/gif",
	"jpg": "image/jpeg",
	// audio
	"mp3": "audio/mpeg"
};

function get(filename){
	var extname = path.extname(filename).slice(1);
	var mimetype;

	if( extname in mimetypes ){
		mimetype = mimetypes[extname];
	}
	else{
		mimetype = defaultMimetype;
	}

	return mimetype;
}

module.exports = get;