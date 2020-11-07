var Promise = require('bluebird')
var _ = require('lodash')
var fs = Promise.promisifyAll(require('fs'))
var request = Promise.promisify(require('request'))
var childProcess = require('child_process')
var path = require('path')
var config = require('../config')

var escapePath = function (path) {
  return path.replace(/(\s+)/g, '\\$1')
}

var print = function (filePath, opts) {
  opts = _.defaults(opts, {
    fitToPage: false,
    margin: 0,
    marginTop: 0,
    center: false
  })

  if (!opts.marginTop) {
    opts.marginTop = opts.margin
  }

  return new Promise(function (resolve, reject) {
    var command = [
      'lpr',
      '-P ' + config.PRINTER_NAME,
      '-o media=1744907_4_in_x_6_in',
      opts.fitToPage ? '-o fit-to-page' : '',
      opts.center ? '' : `-o page-left=${opts.margin}`,
      opts.center ? '' : `-o page-right=${opts.margin}`,
      opts.center ? '' : `-o page-top=${opts.marginTop}`,
      opts.center ? '' : `-o page-bottom=${opts.margin}`,
      opts.center ? '-o position=center' : '',
      escapePath(filePath)
    ].join(' ')

    console.log(command)

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

var printLabel = function (label) {
  return Promise
    .bind({
      label
    })
    .then(function () {
      return saveImage(this.label.labelUrl, path.join(config.LABEL_PATH, `${this.label.trackingCode}.png`))
    })
    .tap(function (outputPath) {
      var opts = {}
      switch (this.label.service) {
        case 'USPS':
          opts = {
            marginTop: 10
          }
          break
        case 'UPS':
          opts = {
            // fitToPage: true,
            center: true,
          }
          break
        case 'FEDEX':
          opts = {
            fitToPage: true,
            center: true
          }
          break
        default:
          break
      }

      return print(outputPath, opts)
    })
}

module.exports.printLabel = printLabel
