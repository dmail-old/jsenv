(function(){

	var config = {
		mainModule: 'index',

		include: function(normalizedName, options){
			normalizedName = this.loader.normalize(normalizedName);
			var module = this.loader.createModule(normalizedName);

			// prevent locate()
			if( options && options.address ){
				module.address = options.address;
			}

			return module.then(function(){
				module.parse();
				module.execute();
				return module;
			});
		},

		isInside: function(path, potentialParent){
			function stripLastSep(path){
				if( path[path.length - 1] === '/' ){
					path = path.slice(0, -1);
				}
				return path;
			}

			path = stripLastSep(path);
			potentialParent = stripLastSep(potentialParent);

			// they are the same
			if( path === potentialParent ) return false;
			// 'folder2' not inside 'folder'
			if( path[potentialParent.length] != '/' ) return false;
			// 'folder/file.js' starts with 'folder'
			return path.indexOf(potentialParent) === 0;
		},

		rules: [],

		getRule: function(selector){
			var rules = this.rules, i = 0, j = rules.length, rule;

			for(;i<j;i++){
				rule = rules[i];
				if( rule.selector === selector ) break;
				else rule = null;
			}

			return rule;
		},

		rule: function(selector, properties){
			var rule = this.getRule(selector);

			if( rule ){
				Object.assign(rule.properties, properties);
			}
			else{
				this.rules.push({
					selector: selector,
					properties: properties
				});
				// keep rules sorted (the most specific rule is the last applied)
				this.rules = this.rules.sort(function(a, b){
					return (a.selector ? a.selector.length : 0) - (b.selector ? b.selector.length : 0);
				});
			}
		},

		findMeta: function(normalizedName){
			var name, source, meta, match, selector, properties, origin;

			name = normalizedName;

			meta = {
				source: name
			};

			this.rules.forEach(function(rule){
				selector = rule.selector;
				match = false;

				if( name === selector ){
					match = 'equals';
				}
				else if( this.isInside(name, selector) ){
					match = 'inside';
				}

				if( match ){
					properties = rule.properties;
					Object.assign(meta, properties);

					if( match === 'equals' ){
						if( meta.main ){
							if( !meta.alias ) meta.alias = name;
							meta.alias+= '/' + meta.main;
							if( meta.source ) meta.source+= '/' + meta.main;
							if( meta.origin ) meta.origin+= '/' + meta.main;
						}
					}
					else if( match === 'inside' ){
						if( meta.alias ) meta.alias+= name.slice(selector.length);
						if( meta.source ) meta.source+= name.slice(selector.length);
						if( meta.origin ) meta.origin+= name.slice(selector.length);
					}
				}
			}, this);

			return meta;
		}
	};

	Object.assign(jsenv, config);
	jsenv.define('config', config);

})();