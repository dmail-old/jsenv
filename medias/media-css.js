(function(){

	var CSSMediaParser = {
		type: 'text/css',

		collectDependencies: function(module){
			// [array of css files having @include]
		},

		eval: function(css, location){
			// define how the css is evaluated, like creating a style tag
		},

		parse: function(module){
			return this.eval(module.source, module.address);
		},

		execute: function(module){
			// define how the css is executed, like document.head.appendChild(module.parsed)
		}
	};

	jsenv.defineMedia('text/css', 'css', CSSMediaParser);
	jsenv.define('parser-css', CSSMediaParser);

})();