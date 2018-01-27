'use strict';

const APP_ROOT = '../../';

const _       = require('lodash');
const co      = require('co');
const Promise = require("bluebird");
const http    = require('superagent-promise')(require('superagent'), Promise);
const aws4    = require('../../lib/aws4');
const URL     = require('url');
const mode    = process.env.TEST_MODE;

let respondFrom = function (httpRes) {
  let contentType = _.get(httpRes, 'headers.content-type', 'application/json');
  let body = 
    contentType === 'application/json'
      ? httpRes.body
      : httpRes.text;

  return { 
    statusCode: httpRes.status,
    body: body,
    headers: httpRes.headers
  };
}

let signHttpRequest = (url, httpReq) => {
  let urlData = URL.parse(url);
  let opts = {
    host: urlData.hostname, 
    path: urlData.pathname
  };

  aws4.sign(opts);

  httpReq
    .set('Host', opts.headers['Host'])
    .set('X-Amz-Date', opts.headers['X-Amz-Date'])
    .set('Authorization', opts.headers['Authorization']);

  if (opts.headers['X-Amz-Security-Token']) {
    httpReq.set('X-Amz-Security-Token', opts.headers['X-Amz-Security-Token']);
  }
}

let viaHttp = co.wrap(function* (relPath, method, opts) {
  let root = process.env.TEST_ROOT;
  let url = `${root}/${relPath}`;
  console.log(`invoking via HTTP ${method} ${url}`);

  try {
    let httpReq = http(method, url);

    let body = _.get(opts, "body");
    if (body) {      
      httpReq.send(body);
    }

    if (_.get(opts, "iam_auth", false) === true) {
      signHttpRequest(url, httpReq);
    }

    let authHeader = _.get(opts, "auth");
    if (authHeader) {
      httpReq.set('Authorization', authHeader);
    }
    
    let res = yield httpReq;
    return respondFrom(res);
  } catch (err) {
    if (err.status) {
      return {
        statusCode: err.status,
        headers: err.response.headers
      };
    } else {
      throw err;
    }
  }
})

let viaHandler = (event, functionName) => {  
  let handler = require(`${APP_ROOT}/functions/${functionName}`).handler;
  console.log(`invoking via handler function ${functionName}`);

  return new Promise((resolve, reject) => {
    let context = {};
    let callback = function (err, response) {
      if (err) {
        reject(err);
      } else {
        let contentType = _.get(response, 'headers.content-type', 'application/json');
        if (response.body && contentType === 'application/json') {
          response.body = JSON.parse(response.body);
        }

        resolve(response);
      }
    };

    handler(event, context, callback);
  });
}

let we_invoke_get_index = co.wrap(function* () {
  let res = 
    mode === 'handler' 
      ? yield viaHandler({}, 'get-index')
      : yield viaHttp('', 'GET');

  return res;
});

let we_invoke_get_restaurants = co.wrap(function* () {
  let res =
    mode === 'handler' 
      ? yield viaHandler({}, 'get-restaurants')
      : yield viaHttp('restaurants', 'GET', { iam_auth: true });

  return res;
});

let we_invoke_search_restaurants = co.wrap(function* (user, theme) {
  let body = JSON.stringify({ theme });
  let auth = user.idToken;

  let res = 
    mode === 'handler'
      ? viaHandler({ body }, 'search-restaurants')
      : viaHttp('restaurants/search', 'POST', { body, auth })

  return res;
});

module.exports = {
  we_invoke_get_index,
  we_invoke_get_restaurants,
  we_invoke_search_restaurants
};