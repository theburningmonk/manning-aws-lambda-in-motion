'use strict';

const co = require('co');
const expect = require('chai').expect;
const init = require('../steps/init').init;
const when = require('../steps/when');
const cheerio = require('cheerio');

describe(`When we invoke the GET / endpoint`, co.wrap(function* () {
  before(co.wrap(function* () {
    yield init();
  }));

  it(`Should return the index page with 8 restaurants`, co.wrap(function* () {
    let res = yield when.we_invoke_get_index();

    expect(res.statusCode).to.equal(200);
    expect(res.headers['content-type']).to.equal('text/html; charset=UTF-8');
    expect(res.body).to.not.be.null;

    const $ = cheerio.load(res.body);
    let restaurants = $('.restaurant', '#restaurantsUl');  
    expect(restaurants.length).to.equal(8);

  }));
}));