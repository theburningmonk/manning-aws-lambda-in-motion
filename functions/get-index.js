'use strict';

const co         = require('co');
const Promise    = require('bluebird');
const fs         = Promise.promisifyAll(require("fs"));
const apiHandler = require('../lib/apiHandler');
const http       = require('superagent-promise')(require('superagent'), Promise);
const Mustache   = require('mustache');

const restaurantApiRoot = process.env.restaurant_api;

const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
var html;

function* loadHtml() {
  if (!html) {
    console.log('loading index.html...');
    html = fs.readFileAsync('static/index.html', 'utf-8');
    console.log('loaded');
  }
  
  return html;
}

function* getRestaurants() {
  return (yield http.get(restaurantApiRoot)).body;
}

module.exports.handler = apiHandler(co.wrap(function* (event, context, callback) {
  let template = yield loadHtml();
  let restaurants = yield getRestaurants();
  let dayOfWeek = days[ new Date().getDay() ];
  let html = Mustache.render(template, { dayOfWeek, restaurants });

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/html; charset=UTF-8'
    },
    body: html
  };
}));