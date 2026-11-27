'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const {
  diffPermissionSets,
  DESIRED_KEYS
} = require('../src/scripts/repair-employee-role')

test('adds missing keys and removes excess keys in one pass', () => {
  const current = ['employee.read', 'dashboard.read', 'leave_request.create']
  // leave_request.create ikut terbuang karena tidak ada di daftar target yang diberikan.
  assert.deepEqual(diffPermissionSets(current, ['dashboard.read', 'leave_request.read']), {
    toAdd: ['leave_request.read'],
    toRemove: ['employee.read', 'leave_request.create']
  })
})

test('is a no-op when the set already matches', () => {
  const result = diffPermissionSets(DESIRED_KEYS, DESIRED_KEYS)
  assert.deepEqual(result, { toAdd: [], toRemove: [] })
})

test('never grants a decision permission to the employee role', () => {
  // Guard alasan utama skrip ini ada: karyawan biasa tidak boleh bisa memutuskan cuti.
  for (const key of DESIRED_KEYS) {
    assert.ok(!key.endsWith('.decide'), `${key} tidak boleh ada di set EMPLOYEE`)
    assert.ok(!key.includes('.decide_'), `${key} tidak boleh ada di set EMPLOYEE`)
  }
  assert.ok(!DESIRED_KEYS.includes('employee.read'))
  assert.ok(!DESIRED_KEYS.includes('employee.export'))
})

test('ignores duplicate current rows', () => {
  const result = diffPermissionSets(['dashboard.read', 'dashboard.read'], DESIRED_KEYS)
  assert.deepEqual(result.toRemove, [])
  assert.equal(result.toAdd.length, DESIRED_KEYS.length - 1)
})
