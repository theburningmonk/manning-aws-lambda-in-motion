/**
 * Manage context keys as node Globals
 */

function clearAll() {
  global.CONTEXT = undefined
}

function replaceAllWith(ctx) {
  global.CONTEXT = ctx
}

const prefix = 'x-correlation-'

function prefixKey(key) {
  if (!key.startsWith(prefix)) {
    return `${prefix}${key}`
  }
  return key
}

function set(key, value) {
  const contextKey = prefixKey(key)
  if (!global.CONTEXT) {
    global.CONTEXT = {}
  }
  global.CONTEXT[contextKey] = value
}

function get() {
  return global.CONTEXT || {}
}

module.exports = {
  clearAll,
  replaceAllWith,
  set,
  get
}
