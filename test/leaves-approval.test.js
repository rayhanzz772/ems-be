'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const {
  LEVELS,
  countWorkDays,
  resolveApprovalChain,
  authorizeDecision
} = require('../src/modules/leaves/service')

const employee = { id: 'e-1', status: true, employment_status: 'ACTIVE' }
const activeManager = { id: 'm-1', status: true, employment_status: 'ACTIVE' }

test('counts only ISO working days inside the range', () => {
  assert.equal(countWorkDays('2026-11-23', '2026-11-27'), 5)
  assert.equal(countWorkDays('2026-11-27', '2026-11-30'), 2)
  assert.equal(countWorkDays('2026-11-28', '2026-11-29'), 0)
  assert.equal(countWorkDays('2026-11-27', '2026-11-23'), 0)
})

test('skips holidays and honours a custom work week', () => {
  assert.equal(countWorkDays('2026-11-23', '2026-11-27', { holidays: ['2026-11-26'] }), 4)
  assert.equal(countWorkDays('2026-11-23', '2026-11-27', { workDays: [1, 3, 5] }), 3)
})

test('resolves an active manager as level 1', () => {
  assert.deepEqual(resolveApprovalChain({ employee, manager: activeManager }), {
    currentLevel: LEVELS.LEVEL_1,
    level1EmployeeId: 'm-1'
  })
})

test('falls back to level 2 when the manager is missing or inactive', () => {
  assert.deepEqual(resolveApprovalChain({ employee, manager: null }), {
    currentLevel: LEVELS.LEVEL_2,
    level1EmployeeId: null
  })
  assert.deepEqual(resolveApprovalChain({
    employee,
    manager: { ...activeManager, employment_status: 'RESIGNED' }
  }), {
    currentLevel: LEVELS.LEVEL_2,
    level1EmployeeId: null
  })
})

test('never lets the requester be their own approver', () => {
  assert.deepEqual(resolveApprovalChain({ employee, manager: employee }), {
    currentLevel: LEVELS.LEVEL_2,
    level1EmployeeId: null
  })
})

test('level 1 needs both the permission and the assigned row', () => {
  const leaveRequest = { employee_id: 'e-1', level_1_employee_id: 'm-1' }

  assert.equal(authorizeDecision({
    level: LEVELS.LEVEL_1,
    callerEmployeeId: 'm-1',
    callerPermissions: [],
    leaveRequest
  }).allowed, false)

  assert.equal(authorizeDecision({
    level: LEVELS.LEVEL_1,
    callerEmployeeId: 'm-2',
    callerPermissions: ['leave_request.decide_direct_report'],
    leaveRequest
  }).allowed, false)

  assert.equal(authorizeDecision({
    level: LEVELS.LEVEL_1,
    callerEmployeeId: 'm-1',
    callerPermissions: ['leave_request.decide_direct_report'],
    leaveRequest
  }).allowed, true)
})

test('level 2 needs the HR decision permission', () => {
  const leaveRequest = { employee_id: 'e-1', level_1_employee_id: 'm-1' }

  assert.equal(authorizeDecision({
    level: LEVELS.LEVEL_2,
    callerEmployeeId: 'hr-1',
    callerPermissions: [],
    leaveRequest
  }).allowed, false)

  assert.equal(authorizeDecision({
    level: LEVELS.LEVEL_2,
    callerEmployeeId: 'hr-1',
    callerPermissions: ['leave_request.decide'],
    leaveRequest
  }).allowed, true)
})

test('rejects self approval even with the HR permission', () => {
  const result = authorizeDecision({
    level: LEVELS.LEVEL_2,
    callerEmployeeId: 'e-1',
    callerPermissions: ['leave_request.decide'],
    leaveRequest: { employee_id: 'e-1' }
  })

  assert.equal(result.allowed, false)
  assert.match(result.message, /own requester/)
})
