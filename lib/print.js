var Promise = require('bluebird')
var fs = Promise.promisifyAll(require('fs'))
var request = Promise.promisify(require('request'))
var childProcess = require('child_process')
var path = require('path')
var config = require('../config')

var escapePath = function (path) {
  return path.replace(/(\s+)/g, '\\$1')
}

var print = function (filePath) {
  console.log(filePath)
  return new Promise(function (resolve, reject) {
    var command = [
      'lpr',
      '-P ' + config.PRINTER_NAME,
      '-o media=1744907_4_in_x_6_in',
      '-o page-left=0',
      '-o page-right=0',
      '-o page-top=0',
      '-o page-bottom=0',
      escapePath(filePath)
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

var printLabel = function (label) {
  return Promise
    .bind({
      label
    })
    .then(function () {
      return saveImage(this.label.labelUrl, path.join(config.LABEL_PATH, `${this.label.trackingCode}.png`))
    })
    .tap(function (outputPath) {
      return print(outputPath)
    })
}

module.exports.printLabel = printLabel
