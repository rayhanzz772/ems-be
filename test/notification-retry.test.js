const test = require('node:test')
const assert = require('node:assert/strict')

const { computeNextAttempt, MAX_ATTEMPTS } = require('../src/modules/notification/service')

const now = new Date('2026-11-27T10:00:00.000Z')
const minutesAfter = (n) => new Date(now.getTime() + n * 60 * 1000).toISOString()

test('backoff grows exponentially per attempt', () => {
  assert.equal(computeNextAttempt(0, now).toISOString(), minutesAfter(1))
  assert.equal(computeNextAttempt(1, now).toISOString(), minutesAfter(2))
  assert.equal(computeNextAttempt(2, now).toISOString(), minutesAfter(4))
  assert.equal(computeNextAttempt(3, now).toISOString(), minutesAfter(8))
})

test('stops retrying after the attempt ceiling', () => {
  assert.equal(computeNextAttempt(MAX_ATTEMPTS, now), null)
  assert.equal(computeNextAttempt(MAX_ATTEMPTS + 3, now), null)
})
