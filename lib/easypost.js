var Promise = require('bluebird')
var _ = require('lodash')
var Easypost = require('@easypost/api')
var config = require('../config')

var easypost = new Easypost(config.EASYPOST_API_KEY)
module.exports.easypost = easypost

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

module.exports.createAddress = createAddress

var createParcel = function (service) {
  var parcel = {}

  if (service === 'USPS') {
    _.assign(parcel, {
      predefined_package: 'Parcel',
      weight: 13
    })
  }

  var p = new easypost.Parcel(parcel)
  return p.save()
}

module.exports.createParcel = createParcel

var fromAddress = createAddress({
  name: config.FROM_NAME,
  company: config.FROM_COMPANY,
  street1: config.FROM_STREET1,
  street2: config.FROM_STREET2,
  city: config.FROM_CITY,
  state: config.FROM_STATE,
  zip: config.FROM_ZIP,
  country: config.FROM_COUNTRY,
  phone: config.FROM_PHONE,
  email: config.FROM_EMAIL
})

var createShipment = function (toAddress, service, message) {
  return Promise
    .props({
      from_address: fromAddress,
      to_address: createAddress(toAddress),
      parcel: createParcel(service),
      options: {
        print_custom_1: message
      }
    })
    .then(function (props) {
      var shipment = new easypost.Shipment(props)
      return shipment.save()
    })
}

module.exports.createShipment = createShipment

var buyLabel = function (shipment, service, rate) {
  return Promise
    .bind({
      shipment,
      service,
      rate
    })
    .then(function () {
      var rate = shipment.lowestRate([this.service])
      return shipment.buy(rate)
    })
    .then(function (results) {
      this.labelUrl = results.postage_label.label_url
      this.trackingCode = results.tracking_code
      this.trackingUrl = results.tracker.public_url
      return this
    })
}

module.exports.buyLabel = buyLabel
