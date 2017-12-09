'use strict';

const APP_ROOT = '../../';
const _ = require('lodash');

function viaHandler(event, functionName) {
  let handler = require(`${APP_ROOT}/functions/${functionName}`).handler;

  return new Promise((resolve, reject) => {
    let context = {};
    let callback = function (err, response) {
      if (err) {
        reject(err);
      } else {
        let contentType = _.get(response, 'headers.Content-Type', 'application/json');
        if (response.body && contentType === 'application/json') {
          response.body = JSON.parse(response.body);
        }

        resolve(response);
      }
    };

    handler(event, context, callback);
  });
}

let we_invoke_get_index = () => viaHandler({}, 'get-index');

let we_invoke_get_restaurants = () => viaHandler({}, 'get-restaurants');

let we_invoke_search_restaurants = theme => {
  let event = { 
    body: JSON.stringify({ theme })
  };
  return viaHandler(event, 'search-restaurants');
}

module.exports = {
  we_invoke_get_index,
  we_invoke_get_restaurants,
  we_invoke_search_restaurants
}