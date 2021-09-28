var Promise = require('bluebird')
var fs = Promise.promisifyAll(require('fs'))

var CACHE_FOLDER = '/tmp/airtable-easypost'

var getKey = function (key) {
  return key.replace('.', '-')
}

var getPath = function (key) {
  return `${CACHE_FOLDER}/${getKey(key)}`
}

var get = function (key) {
  return Promise
    .bind({
      key: key
    })
    .then(function () {
      return fs.mkdirAsync(CACHE_FOLDER, { recursive: true })
    })
    .then(function () {
      return fs.readFileAsync(getPath(this.key))
    })
    .then(function (data) {
      var obj = JSON.parse(data.toString())
      if (obj.expiry && obj.expiry <= Date.now()) {
        return
      }

      return obj.data
    })
    .catch(function () {})
}

module.exports.get = get

var set = function (key, data, ttl) {
  return Promise
    .bind({
      key: key,
      data: data,
      ttl: ttl
    })
    .then(function () {
      var obj = {
        data: this.data
      }

      if (this.ttl) {
        obj.expiry = Date.now() + this.ttl
      }

      return fs.writeFileAsync(getPath(this.key), JSON.stringify(obj))
    })
}

module.exports.set = set

module.exports.wrap = function (key, fn, ttl) {
  return Promise
    .bind({
      key: key,
      ttl: ttl,
      fn: fn,
      cached: false
    })
    .then(function () {
      return get(this.key)
    })
    .then(function (data) {
      if (data) {
        this.cached = true
        return data
      }

      return this.fn()
    })
    .tap(function (data) {
      if (this.cached) {
        return
      }

      return set(this.key, data, this.ttl)
    })
}
