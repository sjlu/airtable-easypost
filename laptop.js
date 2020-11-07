var Promise = require('bluebird')
var inquirer = require('inquirer')
var _ = require('lodash')
var moment = require('moment')
var { table } = require('table')
var { createShipment, buyLabel, formatAddress } = require('./lib/easypost')
var { printLabel } = require('./lib/print')

var formatDeliveryEst = function (rate) {
  var date = ''
  if (rate.delivery_date) {
    date = moment(rate.delivery_date).format('dddd, MMMM D [by] h:mm A').toUpperCase()
  }

  var days = `${rate.delivery_days} DAYS`
  if (rate.delivery_days <= 1) {
    days = `NEXT DAY`
  }

  return {
    date,
    days
  }
}

Promise
  .bind({})
  .then(function () {
    return inquirer.prompt([
      {
        type: 'input',
        name: 'name',
      },
      {
        type: 'input',
        name: 'street1'
      },
      {
        type: 'input',
        name: 'city'
      },
      {
        type: 'input',
        name: 'state'
      },
      {
        type: 'input',
        name: 'zip'
      },
      {
        type: 'input',
        name: 'email'
      },
      {
        type: 'input',
        name: 'phone'
      },
      {
        type: 'confirm',
        name: 'signature',
        default: false
      }
    ])
  })
  .then(function (address) {
    return createShipment(address, 'LAPTOP', {
      signature: address.signature
    })
  })
  .then(function (shipment) {
    this.shipment = shipment

    var rates = _.sortBy(this.shipment.rates, function (rate) {
      return _.parseInt(rate.rate)
    })

    var tableData = [
      [
        'Service',
        'Delivery Days',
        'Delivery Date',
        'Rate'
      ]
    ]

    var ratesByDay = _.chain(rates)
      .filter('delivery_days')
      .filter('delivery_date')
      .groupBy(function (rate) {
        return `${rate.carrier}${rate.delivery_days}`
      })
      .map('0')
      .orderBy('delivery_days', 'desc')
      .sortBy('carrier')
      .value()

    _.each(ratesByDay, function (rate) {
      var {
        date,
        days
      } = formatDeliveryEst(rate)

      tableData.push([
        `${rate.carrier} ${rate.service}`,
        days,
        date,
        `$${rate.rate}`
      ])
    })

    console.log(table(tableData))

    var choices = _.map(ratesByDay, function (rate) {
      return {
        name: `${rate.carrier} ${rate.service} ($${rate.rate})`,
        value: rate
      }
    })

    return inquirer.prompt([
      {
        type: 'list',
        name: 'rate',
        choices,
        loop: false
      }
    ])
  })
  .then(function (prompts) {
    var rate = prompts.rate
    var address = this.shipment.to_address

    this.rate = rate

    var {
      date,
      days
    } = formatDeliveryEst(rate)

    var tableData = [
      [
        'Address',
        'Service'
      ],
      [
        formatAddress(address),
        [
          `${rate.carrier} ${rate.service}`,
          date ? date : days,
          `$${rate.rate}`
        ].join('\n')
      ]
    ]

    console.log(table(tableData))

    return inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Purchase?',
        default: false
      }
    ])
  })
  .then(function (prompts) {
    if (prompts && prompts.confirm) {
      return true
    }

    throw new Error()
  })
  .then(function () {
    return buyLabel(this.shipment, this.rate.carrier, this.rate)
  })
  .then(function (label) {
    this.label = label
    return printLabel(label)
  })
  .catch(function (err) {
    console.error(err)
    console.log(err.errors)
  })
