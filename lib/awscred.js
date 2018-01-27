var fs = require('fs'),
    path = require('path'),
    http = require('http'),
    env = process.env

exports.credentialsCallChain = [
  loadCredentialsFromEnv,
  loadCredentialsFromIniFile,
  loadCredentialsFromEc2Metadata,
  loadCredentialsFromEcs,
]

exports.regionCallChain = [
  loadRegionFromEnv,
  loadRegionFromIniFile,
]

exports.load = exports.loadCredentialsAndRegion = loadCredentialsAndRegion
exports.loadCredentials = loadCredentials
exports.loadRegion = loadRegion
exports.loadRegionSync = loadRegionSync
exports.loadCredentialsFromEnv = loadCredentialsFromEnv
exports.loadRegionFromEnv = loadRegionFromEnv
exports.loadRegionFromEnvSync = loadRegionFromEnvSync
exports.loadCredentialsFromIniFile = loadCredentialsFromIniFile
exports.loadRegionFromIniFile = loadRegionFromIniFile
exports.loadRegionFromIniFileSync = loadRegionFromIniFileSync
exports.loadCredentialsFromEc2Metadata = loadCredentialsFromEc2Metadata
exports.loadProfileFromIniFile = loadProfileFromIniFile
exports.loadProfileFromIniFileSync = loadProfileFromIniFileSync
exports.merge = merge

function loadCredentialsAndRegion(options, cb) {
  if (!cb) { cb = options; options = {} }
  cb = once(cb)

  var out = {}, callsRemaining = 2

  function checkDone(propName) {
    return function(err, data) {
      if (err) return cb(err)
      out[propName] = data
      if (!--callsRemaining) return cb(null, out)
    }
  }

  loadCredentials(options, checkDone('credentials'))

  loadRegion(options, checkDone('region'))
}

function loadCredentials(options, cb) {
  if (!cb) { cb = options; options = {} }
  var credentialsCallChain = options.credentialsCallChain || exports.credentialsCallChain

  function nextCall(i) {
    credentialsCallChain[i](options, function(err, credentials) {
      if (err) return cb(err)

      if (credentials.accessKeyId && credentials.secretAccessKey)
        return cb(null, credentials)

      if (i >= credentialsCallChain.length - 1)
        return cb(null, {})

      nextCall(i + 1)
    })
  }
  nextCall(0)
}

function loadRegion(options, cb) {
  if (!cb) { cb = options; options = {} }
  var regionCallChain = options.regionCallChain || exports.regionCallChain

  function nextCall(i) {
    regionCallChain[i](options, function(err, region) {
      if (err) return cb(err)

      if (region)
        return cb(null, region)

      if (i >= regionCallChain.length - 1)
        return cb(null, 'us-east-1')

      nextCall(i + 1)
    })
  }
  nextCall(0)
}

function loadRegionSync(options) {
  return loadRegionFromEnvSync(options) || loadRegionFromIniFileSync(options)
}

function loadCredentialsFromEnv(options, cb) {
  if (!cb) { cb = options; options = {} }

  cb(null, {
    accessKeyId: env.AWS_ACCESS_KEY_ID || env.AMAZON_ACCESS_KEY_ID || env.AWS_ACCESS_KEY,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY || env.AMAZON_SECRET_ACCESS_KEY || env.AWS_SECRET_KEY,
    sessionToken: env.AWS_SESSION_TOKEN || env.AMAZON_SESSION_TOKEN,
  })
}

function loadRegionFromEnv(options, cb) {
  if (!cb) { cb = options; options = {} }

  cb(null, loadRegionFromEnvSync())
}

function loadRegionFromEnvSync() {
  return env.AWS_REGION || env.AMAZON_REGION || env.AWS_DEFAULT_REGION
}

function loadCredentialsFromIniFile(options, cb) {
  if (!cb) { cb = options; options = {} }

  loadProfileFromIniFile(options, 'credentials', function(err, profile) {
    if (err) return cb(err)
    cb(null, {
      accessKeyId: profile.aws_access_key_id,
      secretAccessKey: profile.aws_secret_access_key,
      sessionToken: profile.aws_session_token,
    })
  })
}

function loadRegionFromIniFile(options, cb) {
  if (!cb) { cb = options; options = {} }

  loadProfileFromIniFile(options, 'config', function(err, profile) {
    if (err) return cb(err)
    cb(null, profile.region)
  })
}

function loadRegionFromIniFileSync(options) {
  return loadProfileFromIniFileSync(options || {}, 'config').region
}

var TIMEOUT_CODES = ['ECONNRESET', 'ETIMEDOUT', 'EHOSTUNREACH', 'Unknown system errno 64']
var ec2Callbacks = []
var ecsCallbacks = []

function loadCredentialsFromEcs(options, cb) {
  if (!cb) { cb = options; options = {} }

  ecsCallbacks.push(cb)
  if (ecsCallbacks.length > 1) return // only want one caller at a time

  cb = function(err, credentials) {
    ecsCallbacks.forEach(function(cb) { cb(err, credentials) })
    ecsCallbacks = []
  }

  if (options.timeout == null) options.timeout = 5000
  options.host = '169.254.170.2'
  options.path = process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI

  return request(options, function(err, res, data) {    
    if (err && ~TIMEOUT_CODES.indexOf(err.code)) return cb(null, {})
    if (err) return cb(err)

    if (res.statusCode != 200)
      return cb(new Error('Failed to fetch IAM role: ' + res.statusCode + ' ' + data))

    try { data = JSON.parse(data) } catch (e) { }

    if (res.statusCode != 200)
      return cb(new Error('Failed to fetch IAM credentials: ' + res.statusCode + ' ' + data))    

    cb(null, {
      accessKeyId: data.AccessKeyId,
      secretAccessKey: data.SecretAccessKey,
      sessionToken: data.Token,
      expiration: new Date(data.Expiration),
    })
  })
}

function loadCredentialsFromEc2Metadata(options, cb) {
  if (!cb) { cb = options; options = {} }

  ec2Callbacks.push(cb)
  if (ec2Callbacks.length > 1) return // only want one caller at a time

  cb = function(err, credentials) {
    ec2Callbacks.forEach(function(cb) { cb(err, credentials) })
    ec2Callbacks = []
  }

  if (options.timeout == null) options.timeout = 5000
  options.host = '169.254.169.254'
  options.path = '/latest/meta-data/iam/security-credentials/'

  return request(options, function(err, res, data) {
    if (err && ~TIMEOUT_CODES.indexOf(err.code)) return cb(null, {})
    if (err) return cb(err)

    if (res.statusCode != 200)
      return cb(new Error('Failed to fetch IAM role: ' + res.statusCode + ' ' + data))

    options.path += data.split('\n')[0]
    request(options, function(err, res, data) {
      if (err) return cb(err)

      try { data = JSON.parse(data) } catch (e) { }

      if (res.statusCode != 200 || data.Code != 'Success')
        return cb(new Error('Failed to fetch IAM credentials: ' + res.statusCode + ' ' + data))

      cb(null, {
        accessKeyId: data.AccessKeyId,
        secretAccessKey: data.SecretAccessKey,
        sessionToken: data.Token,
        expiration: new Date(data.Expiration),
      })
    })
  })
}

function loadProfileFromIniFile(options, defaultFilename, cb) {
  var filename = options.filename || path.join(resolveHome(), '.aws', defaultFilename),
      profile = options.profile || resolveProfile()

  fs.readFile(filename, 'utf8', function(err, data) {
    if (err && err.code == 'ENOENT') return cb(null, {})
    if (err) return cb(err)
    cb(null, parseAwsIni(data)[profile] || {})
  })
}

function loadProfileFromIniFileSync(options, defaultFilename) {
  var filename = options.filename || path.join(resolveHome(), '.aws', defaultFilename),
      profile = options.profile || resolveProfile(),
      data

  try {
    data = fs.readFileSync(filename, 'utf8')
  } catch (err) {
    if (err.code == 'ENOENT') return {}
    throw err
  }

  return parseAwsIni(data)[profile] || {}
}

function merge(obj, options, cb) {
  if (!cb) { cb = options; options = {} }

  var needRegion = !obj.region
  var needCreds = !obj.credentials || !obj.credentials.accessKeyId || !obj.credentials.secretAccessKey

  function loadCreds(cb) {
    if (needRegion && needCreds) {
      return loadCredentialsAndRegion(options, cb)
    } else if (needRegion) {
      return loadRegion(options, function(err, region) { cb(err, {region: region}) })
    } else if (needCreds) {
      return loadCredentials(options, function(err, credentials) { cb(err, {credentials: credentials}) })
    }
    cb(null, {})
  }

  loadCreds(function(err, creds) {
    if (err) return cb(err)

    if (creds.region) obj.region = creds.region
    if (creds.credentials) {
      if (!obj.credentials) {
        obj.credentials = creds.credentials
      } else {
        Object.keys(creds.credentials).forEach(function(key) {
          if (!obj.credentials[key]) obj.credentials[key] = creds.credentials[key]
        })
      }
    }

    cb()
  })
}

function resolveProfile() {
  return env.AWS_PROFILE || env.AMAZON_PROFILE || 'default'
}

function resolveHome() {
  return env.HOME || env.USERPROFILE || ((env.HOMEDRIVE || 'C:') + env.HOMEPATH)
}

// Fairly strict INI parser – will only deal with alpha keys, must be within sections
function parseAwsIni(ini) {
  var section,
      out = Object.create(null),
      re = /^\[([^\]]+)\]\s*$|^([a-z_]+)\s*=\s*(.+?)\s*$/,
      lines = ini.split(/\r?\n/)

  lines.forEach(function(line) {
    var match = line.match(re)
    if (!match) return
    if (match[1]) {
      section = match[1]
      if (out[section] == null) out[section] = Object.create(null)
    } else if (section) {
      out[section][match[2]] = match[3]
    }
  })

  return out
}

function request(options, cb) {
  cb = once(cb)

  var req = http.request(options, function(res) {
    var data = ''
    res.setEncoding('utf8')
    res.on('error', cb)
    res.on('data', function(chunk) { data += chunk })
    res.on('end', function() { cb(null, res, data) })
  }).on('error', cb)

  if (options.timeout != null) {
    req.setTimeout(options.timeout)
    req.on('timeout', function() { req.abort() })
  }

  req.end()
}

function once(cb) {
  var called = false
  return function() {
    if (called) return
    called = true
    cb.apply(this, arguments)
  }
}