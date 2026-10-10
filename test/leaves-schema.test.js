'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const {
  createLeaveTypeSchema,
  updateLeaveTypeSchema,
  createLeaveRequestSchema,
  updateLeaveRequestSchema,
  decideLeaveRequestSchema,
  createLeaveBalanceSchema,
  updateLeaveBalanceSchema
} = require('../src/modules/leaves/schema')

test('leave type schemas validate required fields and optional updates', () => {
  assert.deepEqual(createLeaveTypeSchema.parse({
    name: ' Annual Leave ',
    color: '#12aBcD'
  }), {
    name: 'Annual Leave',
    color: '#12aBcD'
  })
  assert.equal(createLeaveTypeSchema.safeParse({ name: 'Annual', color: 'blue' }).success, false)
  assert.equal(updateLeaveTypeSchema.safeParse({}).success, false)
  assert.deepEqual(updateLeaveTypeSchema.parse({ is_active: false }), { is_active: false })
})

test('leave request schemas validate real ordered dates and positive durations', () => {
  const validRequest = {
    employee_id: 'employee-1',
    leave_type_id: 'leave-type-1',
    start_date: '2026-10-10',
    end_date: '2026-10-12',
    duration_days: 2,
    reason: 'Personal matter'
  }
  assert.equal(createLeaveRequestSchema.safeParse(validRequest).success, true)
  assert.equal(createLeaveRequestSchema.safeParse({
    ...validRequest,
    start_date: '2026-02-30'
  }).success, false)
  assert.equal(createLeaveRequestSchema.safeParse({
    ...validRequest,
    end_date: '2026-10-09'
  }).success, false)
  assert.equal(createLeaveRequestSchema.safeParse({
    ...validRequest,
    duration_days: 0
  }).success, false)
  assert.deepEqual(updateLeaveRequestSchema.parse({ reason: 'Updated reason' }), {
    reason: 'Updated reason'
  })
})

test('leave decision and balance schemas constrain state changes and allocations', () => {
  assert.equal(decideLeaveRequestSchema.safeParse({ status: 'APPROVED' }).success, true)
  assert.equal(decideLeaveRequestSchema.safeParse({ status: 'CANCELLED' }).success, false)
  assert.equal(createLeaveBalanceSchema.safeParse({
    employee_id: 'employee-1',
    leave_type_id: 'leave-type-1',
    year: 2026,
    allocated_days: 12
  }).success, true)
  assert.equal(createLeaveBalanceSchema.safeParse({
    employee_id: 'employee-1',
    leave_type_id: 'leave-type-1',
    year: 2026,
    allocated_days: -1
  }).success, false)
  assert.equal(updateLeaveBalanceSchema.safeParse({}).success, false)
})
