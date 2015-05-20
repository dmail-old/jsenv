/*
charger le mainModule, lire ses dépendances
charger les dépendances récursivement

si on a déjà le module
	pas d'option -update -> fin
	option -update -> récupère depuis origin avec un if-modified-since correspondant à fs.stat.mtime
		302 -> ne fais rien
		200 -> response 'last-modified' > request 'if-modified-since' alors ne fais rien, sinon writeFile
sinon
	récupère depuis origin & writeFile
*/

var filesystem = require('./utils/filesystem');
var update = false;

require(process.env.JSENV_PROJECT_PATH);

ENV.onload = function(){
	if( !this.mainModule ){
		throw new Error('no main module defined, cannot install');
	}

	console.log('create the main module', this.mainModule);

	var module = this.createModule(this.mainModule), promise = Promise.resolve();

	[
		module.locate,
		module.fetch,
		module.translate,
		module.collectDependencies
	].forEach(function(method){
		promise = promise.then(method.bind(module));
	});

	// got module dependencies
	promise.then(function(){
		console.log('module dependencies are', module.dependencies);

		// on va essayer de trouver toutes les dépendances selon l'algo au dessus
		// donc il faut qu'on commence par les localiser, voir si elles ont une propriété origin
		// si pas de propriété origin, on check si la propriété path mène bien à un fichier
		// si oui, passe à la suite, sinon c'est une erreur MODULE_NOT_FOUND
		// une fois qu'on les as télécharger, on a plus qu'à faire
		// dependency.translate + dependency.collectDependencies
		// et on continue ainsi de suite
		// la moindre erreur doit tout faire capoter

		function fetchOrigin(module){
			var address = module.address;
			module.address = module.meta.origin;
			return module.fetch().then(function(){
				module.address = address;
			});
		}

		Promise.resolve().then(function(){
			return Promise.all(module.dependencies.map(function(dependency){
				// on a seulement besoin de connaitre le meta de la dépendance mais
				// on appelle locate() parce que par défaut le prochain locate() n'a pas d'effet
				// mais idéalement faudrait éviter d'apeller locate() "inutilement"
				return dependency.locate();
			}));
		}).then(function(){
			return Promise.all(module.dependencies.map(function(dependency){
				// install means : when fetch fails fetch from origin if set
				return dependency.fetch().catch(function(error){
					if( !error || error.code !== 'MODULE_NOT_FOUND' ) return Promise.reject(error);

					// path = not found & origin is null so not found
					if( !dependency.meta.origin ) throw error;

					// ok so try to fetch from origin now
					// then we have to write to path, if path is a local file -> writeFile
					// if path use github -> commit
					// if path use https -> PUT
					// pour le moment on va supporter que file
					return fetchOrigin(dependency);
				});

			}));
		});

	}).catch(function(error){
		console.log(error.stack);
	});
};