'use strict';

const co      = require('co');
const Promise = require('bluebird');
const fs      = Promise.promisifyAll(require("fs"));

var html;

function* loadHtml () {
  if (!html) {
    console.log('loading index.html...');
    html = fs.readFileAsync('static/index.html', 'utf-8');
    console.log('loaded');
  }
  
  return html;
}

module.exports.handler = co.wrap(function* (event, context, callback) {
  let html = yield loadHtml();
  let response = {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/html; charset=UTF-8'
    },
    body: html
  };

  callback(null, response);
});
