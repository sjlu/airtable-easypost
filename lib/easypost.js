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
          'phone',
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

var createParcel = function (type) {
  var parcel = {}

  switch (type) {
    case 'SWAG':
      _.assign(parcel, {
        predefined_package: 'Parcel',
        weight: 13
      })
      break
    case 'APPLE_LAPTOP_BOX':
      _.assign(parcel, {
        width: 15,
        height: 11,
        length: 4,
        weight: 96
      })
      break
    case 'FEDEX_LAPTOP_BOX':
      _.assign(parcel, {
        width: 21,
        height: 16,
        length: 5,
        weight: 96
      })
      break
    case 'LETTER':
      _.assign(parcel, {
        predefined_package: 'FlatRateEnvelope',
        weight: 10
      })
      break
    default:
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

var createShipment = function (toAddress, type, opts) {
  return Promise
    .props({
      from_address: fromAddress,
      to_address: createAddress(toAddress),
      parcel: createParcel(type),
      options: {
        print_custom_1: _.get(opts, 'message'),
        delivery_confirmation: _.get(opts, 'signature') ? 'SIGNATURE' : null
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
      var rate = this.rate ? this.rate : shipment.lowestRate([this.service])
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

var formatAddress = function (address) {
  return [
    address.name,
    _.compact([address.street1, address.street2]).join(', '),
    `${address.city} ${address.state}, ${address.zip}`
  ].join('\n')
}

module.exports.formatAddress = formatAddress
