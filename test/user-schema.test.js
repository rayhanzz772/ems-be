'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { createUserSchema, updateUserSchema } = require('../src/modules/user/schema')

const baseUser = {
  email: 'budi@example.com',
  password: 'rahasia123',
  role_id: 'role-1'
}

test('user creation accepts an optional employee link', () => {
  assert.equal(createUserSchema.parse(baseUser).employee_id, undefined)
  assert.equal(createUserSchema.parse({ ...baseUser, employee_id: 'emp-1' }).employee_id, 'emp-1')
  assert.equal(createUserSchema.parse({ ...baseUser, employee_id: null }).employee_id, null)
  assert.equal(createUserSchema.safeParse({ ...baseUser, employee_id: '' }).success, false)
})

test('user update can link, unlink, or leave the employee untouched', () => {
  assert.equal(updateUserSchema.parse({ employee_id: 'emp-1' }).employee_id, 'emp-1')
  assert.equal(updateUserSchema.parse({ employee_id: null }).employee_id, null)
  assert.equal(updateUserSchema.safeParse({}).success, false)
})
