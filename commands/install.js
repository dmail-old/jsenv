/*
charger le mainModule, lire ses dépendances
charger les dépdendances récursivement

si on a déjà le module ne fait rien sauf si l'option -update est passé
là si l'option -force est passé, récupère depuis origin
sinon récupère depuis origin en envoyant un 'if-modified-since' header correspondant à fs.stat.mtime

*/
