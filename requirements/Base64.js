/*\
|*|
|*|  Base64 / binary data / UTF-8 strings utilities
|*|
|*|  https://developer.mozilla.org/en-US/docs/Web/JavaScript/Base64_encoding_and_decoding
|*|
\*/

(function(global){

	/* Array of bytes to base64 string decoding */
	function b64ToUint6(nChr){
		if( nChr > 64 && nChr < 91 ) return nChr - 65;
		if( nChr > 96 && nChr < 123 ) return nChr - 71;
		if( nChr > 47 && nChr < 58 ) return nChr + 4;
		if( nChr === 43 ) return 62;
		if( nChr === 47 ) return 63;
		return 0;
	}

	function base64DecToArr(sBase64, nBlocksSize){
		var sB64Enc = sBase64.replace(/[^A-Za-z0-9\+\/]/g, ""), nInLen = sB64Enc.length,
		nOutLen = nBlocksSize ? Math.ceil((nInLen * 3 + 1 >> 2) / nBlocksSize) * nBlocksSize : nInLen * 3 + 1 >> 2,
		taBytes = new Uint8Array(nOutLen), nMod3, nMod4, nUint24 = 0, nOutIdx = 0, nInIdx = 0;

		for(;nInIdx<nInLen;nInIdx++){
			nMod4 = nInIdx & 3;
			nUint24 |= b64ToUint6(sB64Enc.charCodeAt(nInIdx)) << 6 * (3 - nMod4);
			if( nMod4 === 3 || nInLen - nInIdx === 1 ){
				for(nMod3 = 0;nMod3 < 3 && nOutIdx < nOutLen; nMod3++, nOutIdx++){
					taBytes[nOutIdx] = nUint24 >>> (16 >>> nMod3 & 24) & 255;
				}
				nUint24 = 0;
			}
		}

		return taBytes;
	}

	/* Base64 string to array encoding */
	function uint6ToB64(nUint6){
		if( nUint6 < 26 ) return nUint6 + 65;
		if( nUint6 < 52 ) return nUint6 + 71;
		if( nUint6 < 62 ) return nUint6 - 4;
		if( nUint6 === 62 ) return 43;
		if( nUint6 === 63 ) return 47;
		return 65;
	}

	function base64EncArr(aBytes){
		var nMod3 = 2, sB64Enc = "", nLen = aBytes.length, nUint24 = 0, nIdx = 0;

		for(;nIdx<nLen;nIdx++){
			nMod3 = nIdx % 3;
			if( nIdx > 0 && (nIdx * 4 / 3) % 76 === 0 ){
				sB64Enc += "\r\n";
			}
			nUint24 |= aBytes[nIdx] << (16 >>> nMod3 & 24);
			if( nMod3 === 2 || aBytes.length - nIdx === 1 ){
				sB64Enc += String.fromCharCode(uint6ToB64(nUint24 >>> 18 & 63), uint6ToB64(nUint24 >>> 12 & 63), uint6ToB64(nUint24 >>> 6 & 63), uint6ToB64(nUint24 & 63));
			nUint24 = 0;
			}
		}

		return sB64Enc.substr(0, sB64Enc.length - 2 + nMod3) + (nMod3 === 2 ? '' : nMod3 === 1 ? '=' : '==');
	}

	/* UTF-8 array to DOMString and vice versa */
	function UTF8ArrToStr(aBytes){
		var sView = "", nPart, nLen = aBytes.length, nIdx = 0, charcode;

		for(;nIdx<nLen;nIdx++){
			nPart = aBytes[nIdx];

			/* six bytes */
			if( nPart > 251 && nPart < 254 && nIdx + 5 < nLen ){
				charcode = (nPart - 252) * 1073741824 + (aBytes[++nIdx] - 128 << 24) + (aBytes[++nIdx] - 128 << 18) + (aBytes[++nIdx] - 128 << 12) + (aBytes[++nIdx] - 128 << 6) + aBytes[++nIdx] - 128;
			}
			/* five bytes */
			else if( nPart > 247 && nPart < 252 && nIdx + 4 < nLen ){
				charcode = (nPart - 248 << 24) + (aBytes[++nIdx] - 128 << 18) + (aBytes[++nIdx] - 128 << 12) + (aBytes[++nIdx] - 128 << 6) + aBytes[++nIdx] - 128;
			}
			/* four bytes */
			else if( nPart > 239 && nPart < 248 && nIdx + 3 < nLen ){
				charcode = (nPart - 240 << 18) + (aBytes[++nIdx] - 128 << 12) + (aBytes[++nIdx] - 128 << 6) + aBytes[++nIdx] - 128;
			}
			/* three bytes */
			else if( nPart > 223 && nPart < 240 && nIdx + 2 < nLen ){
				charcode = (nPart - 224 << 12) + (aBytes[++nIdx] - 128 << 6) + aBytes[++nIdx] - 128;
			}
			/* two bytes */
			else if( nPart > 191 && nPart < 224 && nIdx + 1 < nLen ){
				charcode = (nPart - 192 << 6) + aBytes[++nIdx] - 128;
			}
			/* one byte (nPart < 127) */
			else{
				charcode = nPart;
			}

			sView+= String.fromCharCode(charcode);
		}

		return sView;
	}

	function strToUTF8Arr(sDOMStr){
		var aBytes, nChr, nStrLen = sDOMStr.length, nArrLen = 0;

		/* mapping... */
		var nMapIdx = 0;
		for(;nMapIdx<nStrLen;nMapIdx++){
			nChr = sDOMStr.charCodeAt(nMapIdx);
			nArrLen+= nChr < 0x80 ? 1 : nChr < 0x800 ? 2 : nChr < 0x10000 ? 3 : nChr < 0x200000 ? 4 : nChr < 0x4000000 ? 5 : 6;
		}

		aBytes = new Uint8Array(nArrLen);

		var nIdx = 0, nChrIdx = 0;
		for(;nIdx<nArrLen;nChrIdx++){
			nChr = sDOMStr.charCodeAt(nChrIdx);
			/* one byte */
			if( nChr < 128 ){
				aBytes[nIdx++] = nChr;
			}
			/* two bytes */
			else if( nChr < 0x800 ){
				aBytes[nIdx++] = 192 + (nChr >>> 6);
				aBytes[nIdx++] = 128 + (nChr & 63);
			}
			/* three bytes */
			else if( nChr < 0x10000 ){
				aBytes[nIdx++] = 224 + (nChr >>> 12);
				aBytes[nIdx++] = 128 + (nChr >>> 6 & 63);
				aBytes[nIdx++] = 128 + (nChr & 63);
			}
			/* four bytes */
			else if( nChr < 0x200000 ){
				aBytes[nIdx++] = 240 + (nChr >>> 18);
				aBytes[nIdx++] = 128 + (nChr >>> 12 & 63);
				aBytes[nIdx++] = 128 + (nChr >>> 6 & 63);
				aBytes[nIdx++] = 128 + (nChr & 63);
			}
			/* five bytes */
			else if( nChr < 0x4000000 ){
				aBytes[nIdx++] = 248 + (nChr >>> 24);
				aBytes[nIdx++] = 128 + (nChr >>> 18 & 63);
				aBytes[nIdx++] = 128 + (nChr >>> 12 & 63);
				aBytes[nIdx++] = 128 + (nChr >>> 6 & 63);
				aBytes[nIdx++] = 128 + (nChr & 63);
			}
			/* six bytes (nChr <= 0x7fffffff) */
			else{
				aBytes[nIdx++] = 252 + (nChr >>> 30);
				aBytes[nIdx++] = 128 + (nChr >>> 24 & 63);
				aBytes[nIdx++] = 128 + (nChr >>> 18 & 63);
				aBytes[nIdx++] = 128 + (nChr >>> 12 & 63);
				aBytes[nIdx++] = 128 + (nChr >>> 6 & 63);
				aBytes[nIdx++] = 128 + (nChr & 63);
			}
		}

		return aBytes;
	}

	global.Base64 = {
		encode: function(string){
			return base64EncArr(strToUTF8Arr(string));
		},

		decode: function(string){
			return UTF8ArrToStr(base64DecToArr(string));
		}
	};

})(jsenv.global);