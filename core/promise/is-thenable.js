function isThenable(object){
	return Object(object) == object ? typeof object.then === 'function' : false;
}

module.exports = isThenable;