jsenv.define('platform-storages', {
	http: jsenv.store.createHttpStorage(),
	https: jsenv.store.createHttpsStorage(),
	file: require('./storage-file'),
	github: require('./storage-github')
});