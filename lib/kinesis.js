'use strict';

function parsePayload (record) {
  let json = new Buffer(record.kinesis.data, 'base64').toString('utf8');
  return JSON.parse(json);  
}

function getRecords(event) {
  return event.Records.map(parsePayload);
}

module.exports = {
  getRecords
};