var Promise = require('bluebird')
var inquirer = require('inquirer')
var _ = require('lodash')
var request = Promise.promisify(require('request'))
var { table } = require('table')
var { createShipment, buyLabel, formatAddress } = require('./lib/easypost')
var { printLabel } = require('./lib/print')
var config = require('./config')

const SERVICE = 'USPS'

var buyAndPrintShipmentLabel = function (shipment) {
  return Promise
    .bind({
      shipment
    })
    .then(function () {
      return buyLabel(this.shipment, SERVICE)
    })
    .then(function (label) {
      this.label = label
      return printLabel(label)
    })
    .then(function () {
      return this.label
    })
}

var airtableRequest = function (req) {
  req = _.defaults(req, {
    baseUrl: 'https://api.airtable.com/v0/' + config.AIRTABLE_ID,
    headers: {},
    json: true
  })

  req.headers = _.defaults(req.headers, {
    'Authorization': 'Bearer ' + config.AIRTABLE_API_KEY
  })

  return request(req)
    .then(function (resp) {
      if (resp.statusCode !== 200) {
        var err = new Error('AIRTABLE_ERROR')
        err.errors = _.pick(resp, [
          'statusCode',
          'body'
        ])
        throw err
      }

      return resp
    })
}

var getSwagRecords = function () {
  var requiredFields = [
    'Email',
    'Name',
    'Street1',
    'City',
    'State',
    'Zip'
  ]

  var formula = _.map(requiredFields, function (field) {
    return 'NOT({' + field + '} = \'\')'
  })
  formula.push('NOT(USPS)')

  return airtableRequest({
    method: 'GET',
    url: '/Recipients',
    qs: {
      filterByFormula: 'AND(' + formula.join(', ') + ')'
    }
  })
  .then(function (resp) {
    return _.map(resp.body.records, function (record) {
      var fields = _.mapKeys(record.fields, function (value, key) {
        return key.toLowerCase()
      })

      return _.assign({}, fields, {
        id: record.id
      })
    })
  })
}

var updateSwagRecord = function (id, fields) {
  return airtableRequest({
    method: 'PATCH',
    url: '/Recipients/' + id,
    body: {
      fields: fields
    }
  })
  .then(function (resp) {
    return resp.body
  })
}

var buyAndUpdate = function (record, shipment) {
  return Promise
    .bind({
      record: record,
      shipment: shipment
    })
    .then(function () {
      return buyAndPrintShipmentLabel(this.shipment)
    })
    .then(function (label) {
      return updateSwagRecord(this.record.id, {
        USPS: label.trackingCode,
        Tracking: label.trackingUrl
      })
    })
}

var confirmBuyAndUpdate = function (pack) {
  return Promise
    .bind({
      pack: pack
    })
    .then(function () {
      var record = this.pack.record
      var rate = this.pack.shipment.lowestRate([SERVICE])
      var address = this.pack.shipment.to_address

      var tableData = [
        [
          'Email',
          'Address',
          'Service'
        ],
        [
          `${record.email}`,
          formatAddress(address),
          [
            `${rate.carrier} ${rate.service}`,
            `$${rate.rate}`
          ].join('\n')
        ]
      ]

      console.log(table(tableData))
      return inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: 'Are you sure you want to purchase this label?',
          default: false
        }
      ])
    })
    .then(function (prompts) {
      if (prompts && prompts.confirm) {
        return buyAndUpdate(this.pack.record, this.pack.shipment)
      }
    })
}

Promise
  .bind({})
  .then(function () {
    return getSwagRecords()
  })
  .map(function (record) {
    return Promise.props({
      record: record,
      shipment: createShipment(record, 'SWAG', {
        message: record.size
      })
    })
  }, {
    concurrency: 1
  })
  .map(function (pack) {
    return confirmBuyAndUpdate(pack)
  }, {
    concurrency: 1
  })
  .catch(function (err) {
    console.error(err)
    console.log(err.errors)
  })
