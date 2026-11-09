const test = require('node:test')
const assert = require('node:assert/strict')
const { parseCommand, isAuthorized } = require('../dist/commands.js')

test('ignores casual conversation and only recognizes exact !bot prefix', () => {
  assert.equal(parseCommand('hello'), null)
  assert.equal(parseCommand('hello !bot stop'), null)
  assert.deepEqual(parseCommand('!bot stop'), { kind: 'stop' })
})
test('accepts only bounded integer move commands', () => {
  assert.deepEqual(parseCommand('!bot move 4 -6'), { kind: 'move', dx: 4, dz: -6 })
  for (const msg of ['!bot move 100 0', '!bot move 1.2 3', '!bot move NaN 1', '!bot move 0 0', '!bot move 16 16', '!bot move 2']) {
    assert.equal(parseCommand(msg)?.kind, 'error', msg)
  }
})
test('rejects surplus arguments and unauthorized senders', () => {
  assert.equal(parseCommand('!bot stop now')?.kind, 'error')
  assert.equal(isAuthorized('Owner', 'Owner', 'CompanionBot'), true)
  assert.equal(isAuthorized('Intruder', 'Owner', 'CompanionBot'), false)
  assert.equal(isAuthorized('CompanionBot', 'CompanionBot', 'CompanionBot'), false)
})
