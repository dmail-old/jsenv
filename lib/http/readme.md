# http

Provides several helpers arounnd http requests

## createHeaders(init)

Object representing http headers of request or response.

```javascript
var headers = http.createHeaders({
	'accept': 'html'
});

headers.has('accept'); // true
headers.set('user-agent', 'node');
headers.get('user-agent'); // 'node'
headers.delete('user-agent');
headers.toString(); // 'accept: html'

Array.from(headers.values()); // [['html']]
Array.from(headers.keys()); // ['accept']
Array.from(headers.entries()); // [['accept'], [['html']]]
```

## createBody(init)

Object representing http body of request or response. It wraps node & browser streams under a common API.

```javascript
var body = http.createStream();

body.pipeTo(writableStream); // writableStream can be a [node one](https://nodejs.org/api/stream.html#stream_class_stream_writable) or a [browser one](https://streams.spec.whatwg.org/#ws-class)
body.close(); // close this stream and all piped streams & remove pipes
body.tee(); // returns an array of two streams that you can consume or not
body.then(onResolve, onError); // onResolve is called when the body is closed, onError if an error occurs
body.readAsString(); // return a promise fullfilled with body as string or rejected if an error occurs
body.cancel(); // clear all data
```

Depending on init value the stream behave differently :
- undefined : nothing is done
- null : the stream is immediatly closed
- String : the string is written in the stream & the stream is closed
- node ReadableStream : the readable stream is piped into this stream

## createRequest(options)

Object representing an http request. The request is not sent.

```javascript
var request = http.createRequest({
	method: 'GET', // 'GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'
	url: 'http://google.fr', // URL
	headers: header,
	body: stream, // null, Stream
	cacheMode: 'no-cache' // 'default', 'no-cache', 'no-store', 'force-cache', 'reload'
});
```

Cache mode :
- default, force-cache, reload: The response is cached
- no-cache, no-store: The response is not cached

## createResponse(init)

Object representing an http response.

```javascript
var response = http.createResponse({
	status: 200,
	headers: {'content-type': 'text/plain'},
	body: http.createStream('Hello world')
});

response.clone().text().then(console.log); // 'Hello world';
response.clone().json().catch(console.log); // SyntaxError
```

## createClient(request)

Object that will provide a response from a request object

```javascript
var client = http.createClient(request);

client.open(); // send the request to the server
client.then(onResolve, onReject); // onResolve(response) will be called with the response, onReject(error)
client.abort(); // abort the connection, client will not fullfill or reject
```

Client currently supports:
- Storing responses cache in memory
- Findind cached responses by comparing url, method & vary headers
- Providing cached response for request with cacheMode set to 'default'
- Send 'if-modified-since' when a response exists in cache with a 'last-modified' header
- Redirection on 301, 302, 307 response for request.redirectMode set to 'follow'
- Retry request on 301, 302, 307, 503 response with a 'retry-after' header