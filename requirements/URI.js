(function(global){
	// https://gist.github.com/Yaffle/1088850
	// https://github.com/Polymer/URL/blob/master/url.js
	function parseURI(url){
		if( typeof url === 'object' ) return url;
		if( url == null ) throw new TypeError(url + 'is not a valid url');

		url = String(url);
		url = url.replace(/^\s+|\s+$/g, ''); // trim

		var regex = /^([^:\/?#]+:)?(?:\/\/(?:([^:@\/?#]*)(?::([^:@\/?#]*))?@)?(([^:\/?#]*)(?::(\d*))?))?([^?#]*)(\?[^#]*)?(#[\s\S]*)?/;
		// /^([^:\/?#]+:)?(\/\/(?:[^:@\/?#]*(?::[^:@\/?#]*)?@)?(([^:\/?#]*)(?::(\d*))?))?([^?#]*)(\?[^#]*)?(#[\s\S]*)?/;
		var match = url.match(regex);
		// authority = '//' + user + ':' + pass '@' + hostname + ':' port
		var parsed = null;

		if( match ){
			parsed = {
				href     : match[0] || '',
				protocol : match[1] || '',
				username : match[2] || '',
				password : match[3] || '',
				host     : match[4] || '',
				hostname : match[5] || '',
				port     : match[6] || '',
				pathname : match[7] || '',
				search   : match[8] || '',
				hash     : match[9] || ''
			};

			/*
			parsed.authority = '//' +
			(parsed.username ? parsed.username + (parsed.password ? ':' + parsed.password : '') + '@' : '') +
			parsed.host +
			(parsed.port ? ':' + parsed.port : '');
			*/

		}
		else{
			throw new RangeError();
		}

		return parsed;
	}

	function removeDotSegments(input){
		var output = [];

		input
		.replace(/^(\.\.?(\/|$))+/, '')
		.replace(/\/(\.(\/|$))+/g, '/')
		.replace(/\/\.\.$/, '/../')
		.replace(/\/?[^\/]*/g, function(p){
			if( p === '/..' )
				output.pop();
			else
				output.push(p);
		});

		return output.join('').replace(/^\//, input.charAt(0) === '/' ? '/' : '');
	}

	var URI = Function.create({
		constructor: function(url, base){
			url = parseURI(url);

			if( arguments.length > 1 ){
				base = parseURI(base);
				var flag = url.protocol === '' && url.host === '' && url.username === '';

				if( flag && url.pathname === '' && url.search === '' ){
					url.search = base.search;
				}

				if( flag && url.pathname[0] !== '/' ){
					var pathname = '';

					if( url.pathname ){
						if( base.host && base.username && base.pathname === '' ) pathname+= '/';
						pathname+= base.pathname.slice(0, base.pathname.lastIndexOf('/') + 1) + url.pathname;
					}
					else{
						pathname = base.pathname;
					}

					url.pathname = pathname;
				}

				url.pathname = removeDotSegments(url.pathname);

				if( flag ){
					url.port = base.port;
					url.hostname = base.hostname;
					url.host = base.host;
					url.password = base.password;
					url.username = base.username;
				}

				if( url.protocol === '' ){
					url.protocol = base.protocol;
				}
			}

			this.protocol = url.protocol;
			this.username = url.username;
			this.password = url.password;
			this.host = url.host;
			this.hostname = url.hostname;
			this.port = url.port;
			this.pathname = url.pathname;
			this.search = url.search;
			this.hash = url.hash;
		},

		toString: function(){
			var url = '';

			url+= this.protocol;
			url+= this.protocol === '' && this.host === '' ? '' : '//';
			if( this.username ){
				url+= this.username;
				url+= this.password ? ':' + this.password : '';
				url+= '@';
			}
			url+= this.host;
			url+= this.pathname;
			url+= this.search;
			url+= this.hash;

			return url;
		}
	});

	global.URI = URI;

})(jsenv.global);