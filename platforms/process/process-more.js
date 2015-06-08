jsenv.define('more', {
	getName: function(){
		return 'node';
	},

	getVersion: function(){
		return process.version;
	},

	getOs: function(){
		// https://nodejs.org/api/process.html#process_process_platform
		// 'darwin', 'freebsd', 'linux', 'sunos', 'win32'
		var platform = process.platform;
		if( platform === 'win32' ) platform = 'windows';
		return platform;
	},

	init: function(){
		if( require.main === module ){
			throw new Error('jsenv must be required');
		}

		if( !this.mode ){
			this.mode = process.env.JSENV_MODE;
		}

		this.env.init();
	},

	restart: function(){
		process.exit(2);
	}
});