var name = String(process.argv[2]);
debug('runasmain', name);
this.include(name).catch(function(error){
	console.error(error.stack);
});