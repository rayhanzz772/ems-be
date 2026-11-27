const test = require('node:test')
const assert = require('node:assert/strict')

const {
  SESSION_STATES,
  classifySession,
  hashToken
} = require('../src/modules/auth/session')

const now = new Date('2026-11-27T10:00:00.000Z')

test('missing session is invalid', () => {
  assert.equal(classifySession(null, now), SESSION_STATES.INVALID)
})

test('a rotated or revoked session is treated as replay', () => {
  assert.equal(
    classifySession({ revoked_at: new Date('2026-11-27T09:00:00.000Z'), expires_at: new Date('2027-01-01T00:00:00.000Z') }, now),
    SESSION_STATES.REPLAY
  )
})

test('an expired session is rejected', () => {
  assert.equal(
    classifySession({ revoked_at: null, expires_at: new Date('2026-11-27T09:59:59.000Z') }, now),
    SESSION_STATES.EXPIRED
  )
})

test('a live session is valid', () => {
  assert.equal(
    classifySession({ revoked_at: null, expires_at: new Date('2026-11-27T10:00:01.000Z') }, now),
    SESSION_STATES.VALID
  )
})

test('refresh tokens are stored as stable, non-reversible hashes', () => {
  const token = 'a'.repeat(64)
  assert.equal(hashToken(token), hashToken(token))
  assert.equal(hashToken(token).length, 64)
  assert.notEqual(hashToken(token), hashToken('b'.repeat(64)))
  assert.notEqual(hashToken(token), token)
})
