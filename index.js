var Promise = require('bluebird')
var inquirer = require('inquirer')
var _ = require('lodash')
var request = Promise.promisify(require('request'))
var fs = Promise.promisifyAll(require('fs'))
var childProcess = require('child_process')
var os = require('os')
var path = require('path')
var Easypost = require('@easypost/api')
var config = require('./config')

var easypost = new Easypost(config.EASYPOST_API_KEY)

var createAddress = function (address) {
  return Promise
    .bind({
      address: address
    })
    .then(function () {
      var req = _.chain(this.address)
        .pick([
          'name',
          'email',
          'company',
          'street1',
          'street2',
          'city',
          'state',
          'zip'
        ])
        .omitBy(this.address, function (val) {
          return !val || !val.length
        })
        .value()

      _.assign(req, {
        verify: ['delivery']
      })

      var easypostAddress = new easypost.Address(req)
      return easypostAddress.save()
    })
    .then(function (easypostAddress) {
      if (easypostAddress.verifications.delivery.success) {
        return easypostAddress
      }

      var err = new Error('INVALID_ADDRESS')
      err.errors = easypostAddress.verifications.delivery.errors
      throw err
    })
}

var createParcel = function () {
  var parcel = new easypost.Parcel({
    predefined_package: 'Parcel',
    weight: 16
  })
  return parcel.save()
}

var createShipment = function (fromAddress, toAddress, message) {
  return Promise
    .props({
      from_address: createAddress(fromAddress),
      to_address: createAddress(toAddress),
      parcel: createParcel(),
      options: {
        print_custom_1: message
      }
    })
    .then(function (props) {
      var shipment = new easypost.Shipment(props)
      return shipment.save()
    })
}

var printLabel = function (filePath) {
  return new Promise(function (resolve, reject) {
    var command = [
      'lpr',
      '-P ' + config.PRINTER_NAME,
      '-o media=1744907_4_in_x_6_in',
      '-o page-left=0',
      '-o page-right=0',
      '-o page-top=0',
      '-o page-bottom=0',
      filePath
    ].join(' ')

    return childProcess.exec(command, function (err, stdout, stderr) {
      if (err) {
        return reject(err)
      }

      if (stderr) {
        return reject(stderr)
      }

      return resolve(stdout)
    })
  })
}

var saveImage = function (url, outputPath) {
  return request({
    url: url,
    encoding: null
  })
  .then(function (resp) {
    return fs.writeFileAsync(outputPath, resp.body)
  })
  .then(function () {
    return outputPath
  })
}

var buyAndPrintShipmentLabel = function (shipment) {
  return Promise
    .resolve(shipment)
    .bind({})
    .then(function (shipment) {
      return shipment.buy(shipment.lowestRate(['USPS'], ['ParcelSelect']))
    })
    .then(function (results) {
      this.labelUrl = results.postage_label.label_url
      this.trackingCode = results.tracking_code
      this.trackingUrl = results.tracker.public_url
      return saveImage(this.labelUrl, path.join(os.homedir(), 'Downloads', this.trackingCode + '.png'))
    })
    .then(function (outputPath) {
      console.log(outputPath)
      return printLabel(outputPath)
    })
    .then(function () {
      return this
    })
}

var airtableRequest = function (req) {
  req = _.defaults(req, {
    baseUrl: 'https://api.airtable.com/v0/' + config.AIRTABLE_ID
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
    'Company',
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

Promise
  .bind({
    fromAddress: {
      name: config.FROM_NAME,
      company: config.FROM_COMPANY,
      street1: config.FROM_STREET1,
      street2: config.FROM_STREET2,
      city: config.FROM_CITY,
      state: config.FROM_STATE,
      zip: config.FROM_ZIP
    }
  })
  .then(function () {
    return getSwagRecords()
  })
  .map(function (record) {
    return Promise.props({
      record: record,
      shipment: createShipment(this.fromAddress, record, record.size)
    })
  }, {
    concurrency: 1
  })
  .map(function (pack) {
    return buyAndUpdate(pack.record, pack.shipment)
  }, {
    concurrency: 1
  })
  .catch(function (err) {
    console.error(err)
    console.log(err.errors)
  })
