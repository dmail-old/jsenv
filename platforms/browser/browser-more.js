jsenv.define('more', {
	getAgent: function(){
		var ua = navigator.userAgent.toLowerCase();
		var regex = /(opera|ie|firefox|chrome|version)[\s\/:]([\w\d\.]+)?.*?(safari|version[\s\/:]([\w\d\.]+)|$)/;
		var UA = ua.match(regex) || [null, 'unknown', 0];
		var name = UA[1] == 'version' ? UA[3] : UA[1];
		var version;

		// version
		if( UA[1] == 'ie' && document.documentMode ) version = document.documentMode;
		else if( UA[1] == 'opera' && UA[4] ) version = parseFloat(UA[4]);
		else version = parseFloat(UA[2]);

		return {
			name: name,
			version: version
		};
	},

	getName: function(){
		return this.getAgent().name;
	},

	getVersion: function(){
		return this.getAgent().version;
	},

	getOs: function(){
		return navigator.platform.toLowerCase();
	},

	init: function(){
		function ready(){
			var scripts = document.getElementsByTagName('script'), i = 0, j = scripts.length, script;
			for(;i<j;i++){
				script = scripts[i];
				if( script.type === 'module' ){
					jsenv.loader.module(script.innerHTML.slice(1)).catch(function(error){
						setImmediate(function(){ throw error; });
					});
				}
			}

			jsenv.init();
		}

		function completed(){
			document.removeEventListener('DOMContentLoaded', completed);
			window.removeEventListener('load', completed);
			ready();
		}

		if( document.readyState === 'complete' ){
			setTimeout(ready);
		}
		else if( document.addEventListener ){
			document.addEventListener('DOMContentLoaded', completed);
			window.addEventListener('load', completed);
		}
	},

	restart: function(){
		window.location.reload(true);
	}
});