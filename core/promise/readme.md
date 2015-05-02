## map

```javascript
Promise.map(['dam', 'sandra'], function(name){
	return name;
}).then(console.log);
// logs 'dam', 'sandra'
```

## mapReduce

```javascript
Promise.mapReduce(['dam', 'sandra'], function(name){
	return name;
}).then(console.log);
// logs 'sandra'
```

## mapFirst

```javascript
Promise.mapFirst(['dam', 'sandra'], function(name){
	return name;
}).then(console.log);
// logs 'dam'
```