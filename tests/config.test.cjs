const test = require('node:test')
const assert = require('node:assert/strict')
const { loadConfig } = require('../dist/config.js')
const valid = {MC_HOST:'127.0.0.1',MC_PORT:'25568',MC_VERSION:'26.1',MC_AUTH:'offline',MC_USERNAME:'CompanionBot',MC_OWNER:'Player123'}
test('valid proxy setup is accepted', () => {
  const cfg = loadConfig(valid)
  assert.equal(cfg.version, '26.1')
  assert.equal(cfg.port, 25568)
})
test('invalid auth, owner, port and reconnect budgets fail closed', () => {
  assert.throws(() => loadConfig({...valid,MC_AUTH:'bad'}))
  assert.throws(() => loadConfig({...valid,MC_OWNER:'CompanionBot'}))
  assert.throws(() => loadConfig({...valid,MC_PORT:'99999'}))
  assert.throws(() => loadConfig({...valid,MC_RECONNECT_ATTEMPTS:'1000000'}))
})
