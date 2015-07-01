(function(global){
	// https://github.com/WebReflection/url-search-params/tree/master/src
	var replace = {
		'!': '%21',
		"'": '%27',
		'(': '%28',
		')': '%29',
		'~': '%7E',
		'%20': '+',
		'%00': '\x00'
	};

	function replacer(match){
		return replace[match];
	}

	function encode(str){
		return encodeURIComponent(str).replace(/[!'\(\)~]|%20|%00/g, replacer);
	}

	function decode(str) {
		return decodeURIComponent(str.replace(/\+/g, ' '));
	}

	var URLSearchParams = Function.create({
		constructor: function(queryString){
			this.fromString(queryString);
		},

		fromString: function(queryString){
			this.params = {};

			if( queryString ){
				var index, value, pairs = queryString.split('&'), i = 0, length = pairs.length;

				for(;i<length;i++){
					value = pairs[i];
					index = value.indexOf('=');
					if( index > -1 ){
						this.append(
							decode(value.slice(0, index)),
							decode(value.slice(index + 1))
						);
					}
				}
			}
		},

		append: function(name, value){
			var params = this.params;

			value = String(value);
			if( name in params ){
				params[name].push(value);
			}
			else{
				params[name] = [value];
			}
		},

		delete: function(name){
			delete this.params[name];
		},

		get: function(name){
			var params = this.params;
  			return name in params ? params[name][0] : null;
		},

		getAll: function(name){
			var params = this.params;
  			return name in params ? params[name].slice(0) : [];
		},

		has: function(name){
			return name in this.params;
		},

		set: function(name, value){
			value = String(value);
			this.params[name] = [value];
		},

		toJSON: function(){
			return {};
		},

		toString: function(){
			var params = this.params, query = [], key, name, i, value, j;

			for(key in params) {
				name = encode(key);
				i = 0;
				value = params[key];
				j = value.length;

				for(;i<j;i++){
					query.push(name + '=' + encode(value[i]));
				}
			}

			return query.join('&');
		}
	});

	// https://github.com/Polymer/URL/blob/master/url.js
	// https://gist.github.com/Yaffle/1088850
	function parseURL(url){
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

			if( parsed.protocol === 'file:' ){
				parsed.pathname = '/' + parsed.hostname + ':' + parsed.pathname;
				parsed.host = '';
				parsed.hostname = '';
			}
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

	var URL = Function.create({
		constructor: function(url, base){
			url = parseURL(url);

			if( arguments.length > 1 ){
				base = parseURL(base);
				var flag = url.protocol === '' && url.host === '' && url.username === '';

				if( flag && url.pathname === '' && url.search === '' ){
					url.search = base.search;
				}

				if( flag && url.pathname[0] !== '/' ){
					var pathname = '';

					if( url.pathname ){
						if( (base.host || base.username) && base.pathname === '' ) pathname+= '/';
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

			this.searchParams = new URLSearchParams();

			this.protocol = url.protocol;
			this.username = url.username;
			this.password = url.password;
			this.host = url.host;
			this.hostname = url.hostname;
			this.port = url.port;
			this.pathname = url.pathname;
			this.search = url.search;
			this.hash = url.hash;

			if( this.protocol != 'file:' ){
				this.origin = this.protocol;
				if( this.protocol || this.host ) this.origin+= '//';
				this.origin+= this.host;
			}
			else{
				this.origin = 'null';
			}
		},

		get search(){
			return this.searchParams.toString();
		},

		set search(value){
			this.searchParams.fromString(value);
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

	if( false === 'URL' in global ){
		global.URL = URL;
	}

})(jsenv.global);