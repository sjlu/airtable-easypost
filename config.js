var _ = require('lodash')
var dotenv = require('dotenv')

// load dotenv config vars if available
dotenv.config()

var config = {
  NODE_ENV: 'production',
  EASYPOST_API_KEY: null,
  AIRTABLE_ID: null,
  AIRTABLE_API_KEY: null,
  FROM_NAME: null,
  FROM_COMPANY: null,
  FROM_STREET1: null,
  FROM_STREET2: null,
  FROM_CITY: null,
  FROM_STATE: null,
  FROM_ZIP: null,
  FROM_PHONE: null,
  FROM_EMAIL: null,
  PRINTER_NAME: 'DYMO_LabelWriter_4XL',
  LABEL_PATH: null
}

// load object
var keys = _.keys(config)
var envConfig = _.pick(_.assign({}, config, process.env), keys)

module.exports = envConfig
