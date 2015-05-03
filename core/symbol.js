/*
this polyfil is not correct but it does the principal

String(Symbol('test')) -> returns '@@test' instead of returning 'Symbol(test)'
it can collides with existing property named '@@test'

The main goal is to have

Symbol.iterator returning '@@iterator' in non es6 env

*/

(function(global){
	var HiddenSymbol = {
		key: null,
		name: null,
		names: {},

		constructor: function(key){
			key = key === undefined ? '' : String(key);
			this.key = key;
			this.name = this.generateName(key);
		},

		generateName: function(key){
			var id = 0, name;

			name = key;
			while( name in this.names ){
				name = key + id;
				id++;
			}

			this.names[name] = true;

			return '@@' + name;
		},

		toString: function(){
			return this.name;
		},

		valueOf: function(){
			return this;
		},

		'@@toPrimitive': function(){
			return this;
		},

		'@@toStringTag': function(){
			return 'Symbol';
		}
	};
	HiddenSymbol.constructor.prototype = HiddenSymbol;
	HiddenSymbol = HiddenSymbol.constructor;

	var Symbol = {
		constructor: function(key){
			if( this instanceof Symbol ) throw new TypeError('TypeError: Symbol is not a constructor');
			return new HiddenSymbol(key);
		}
	};
	Symbol.constructor.prototype = Symbol;
	Symbol = Symbol.constructor;

	Symbol.symbols = {};
	Symbol.for = function(key){
		var symbol;

		if( key in this.symbols ){
			symbol = this.symbols[key];
		}
		else{
			symbol = Symbol(key);
			this.symbols[key] = symbol;
		}

		return symbol;
	};

	Symbol.is = function(item){
		return item && (typeof item === 'symbol' || item['@@toStringTag'] === 'Symbol');
	};

	Symbol.check = function(item){
		if( !this.is(item) ) throw new TypeError(item + 'is not a symbol');
		return item;
	};

	Symbol.keyFor = function(symbol){
		var key, symbols = this.symbols;

		if( this.check(symbol) ){
			for( key in symbols ) if( symbols[key] === symbol ) return key;
		}
	};

	[
		'hasInstance',
		'isConcatSpreadable',
		'iterator',
		'match',
		'replace',
		'search',
		'species',
		'split',
		'toPrimitive',
		'toStringTag',
		'unscopables'
	].forEach(function(key){
		Symbol[key] = Symbol(key);
	});

	if( !global.Symbol ) global.Symbol = Symbol;

})(typeof window === 'undefined' ? global: window);


