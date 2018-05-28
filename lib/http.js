'use strict';

const correlationIds = require('./correlation-ids');
const http = require('superagent-promise')(require('superagent'), Promise);

function getRequest (options) {
  let uri    = options.uri;
  let method = options.method || '';

  switch (method.toLowerCase()) {
    case '':
    case 'get':
      return http.get(uri);
    case 'head':
      return http.head(uri);
    case 'post':
      return http.post(uri);
    case 'put':
      return http.put(uri);
    case 'delete':
      return http.del(uri);
    default:
      throw new Error(`unsupported method : ${method.toLowerCase()}`);
  }
}

function setHeaders (request, headers) {
  let headerNames = Object.keys(headers);
  headerNames.forEach(h => request = request.set(h, headers[h]));

  return request;
}

function setQueryStrings (request, qs) {
  if (!qs) {
    return request;
  }
  
  return request.query(qs); 
}

function setBody (request, body) {
  if (!body) {
    return request;
  }

  return request.send(body);
}

// options: { 
//    uri     : string
//    method  : GET (default) | POST | PUT | HEAD
//    headers : object
//    qs      : object
//    body    : object
//  }
let Req = (options) => {
  if (!options) {
    throw new Error('no HTTP request options is provided');
  }

  if (!options.uri) {
    throw new Error('no HTTP uri is specified');
  }

  const context = correlationIds.get();

  // copy the provided headers last so it overrides the values from the context
  let headers = Object.assign({}, context, options.headers);

  let request = getRequest(options);

  request = setHeaders(request, headers);
  request = setQueryStrings(request, options.qs);
  request = setBody(request, options.body);

  return request
    .catch(e => {
      if (e.response && e.response.error) {
        throw e.response.error;
      }
      
      throw e;
    });
};

module.exports = Req;