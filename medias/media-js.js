(function(){

	var JavaScriptMediaParser = {
		collectDependencies: (function(){
			// https://github.com/jonschlinkert/strip-comments/blob/master/index.js
			var reLine = /(^|[^\S\n])(?:\/\/)([\s\S]+?)$/gm;
			var reLineIgnore = /(^|[^\S\n])(?:\/\/[^!])([\s\S]+?)$/gm;
			function stripLineComment(str, safe){
				return String(str).replace(safe ? reLineIgnore : reLine, '');
			}

			var reBlock = /\/\*(?!\/)(.|[\r\n]|\n)+?\*\/\n?\n?/gm;
			var reBlockIgnore = /\/\*(?!(\*?\/|\*?\!))(.|[\r\n]|\n)+?\*\/\n?\n?/gm;
			function stripBlockComment(str, safe){
				return String(str).replace(safe ? reBlockIgnore : reBlock, '');
			}

			var reDependency = /(?:^|;|\s+|ENV\.)include\(['"]([^'"]+)['"]\)/gm;
			// for the moment remove regex for static ENV.include(), it's just an improvment but
			// not required at all + it's strange for a dynamic ENV.include to be preloaded
			reDependency = /(?:^|;|\s+)include\(['"]([^'"]+)['"]\)/gm;
			function collectIncludeCalls(str){
				str = stripLineComment(stripBlockComment(str));

				var calls = [], match;
				while(match = reDependency.exec(str) ){
					calls.push(match[1]);
				}
				reDependency.lastIndex = 0;

				return calls;
			}

			return function collectDependencies(module){
				return collectIncludeCalls(module.source);
			};
		})(),

		eval: function(code, url){
			if( url ){
				url = String(url);
				if( url.indexOf('file:/') === 0 ){
					url = url.slice('file:/'.length);
				}
				code+= '\n//# sourceURL=' + url;
			}

			var ret;

			try{
				ret = eval(code);
			}
			catch(e){
				throw new Error(e.name + ' : ' + e.message + ' in ' + url);
			}

			return ret;
		},

		parse: function(module){
			return this.eval('(function(module, include){\n\n' + module.source + '\n\n});', module.address);
		},

		execute: function(module){
			return module.parsed.call(this.global, module, module.include.bind(module));
		}
	};

	jsenv.media.register('application/javascript', JavaScriptMediaParser);
	jsenv.media.registerExtension('application/javascript', 'js');
	jsenv.define('parser-js', JavaScriptMediaParser);

})();