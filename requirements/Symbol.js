/*
this polyfil is not correct but it does the principal

- String(Symbol('test')) -> returns 'Symbol(test)' which can collides with existing property named 'Symbol(test)'
- And for(key in object) will enumerate the symbol properties

But The main goal is to have String(Symbol.iterator) returning a string in non es6 env

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

			return 'Symbol(' + name + ')';
		},

		toString: function(){
			return this.name;
		},
		
		toSource: function(){
			return 'Symbol("' + this.key + '")';
		},

		valueOf: function(){
			return this;
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
	
	HiddenSymbol.prototype[Symbol.toPrimitive] = function(){
		return this;
	};
	HiddenSymbol.prototype[Symbol.toStringTag] = function(){
		return 'Symbol';
	};
	
	Symbol.symbols = {};
	Symbol.for = function(key){
		var symbol, symbols = this.symbols;

		if( key in symbols ){
			symbol = symbols[key];
		}
		else{
			symbol = Symbol(key);
			symbols[key] = symbol;
		}

		return symbol;
	};
	
	Symbol.is = function(item){
		return item && (typeof item === 'symbol' || item[Symbol.toStringTag] === 'Symbol');
	};

	Symbol.check = function(item){
		if( !this.is(item) ) throw new TypeError(item + ' is not a symbol');
		return item;
	};

	Symbol.keyFor = function(symbol){
		var key, symbols = this.symbols;

		if( this.check(symbol) ){
			for( key in symbols ){
				if( symbols[key] === symbol ){
					break;
				}
				else{
					key = null;
				}
			}
		}
		
		return key;
	};

	if( !global.Symbol ) global.Symbol = Symbol;

})(ENV.global);


