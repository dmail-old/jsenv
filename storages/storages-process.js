jsenv.define('platform-storages', {
	http: jsenv.store.createHttpStorage(),
	https: jsenv.store.createHttpsStorage(),
	file: require('../utils/storage-file'),
	github: require('../utils/storage-github')
});