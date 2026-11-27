const test = require('node:test')
const assert = require('node:assert/strict')

const db = require('../db/models')
const requirePermission = require('../src/middleware/permissionMiddleware')

const originalFindByPk = db.User.findByPk

const runMiddleware = async (permission, user) => {
  const request = { user: { id: 'user-1' } }
  let receivedError
  const next = (error) => {
    receivedError = error
  }

  db.User.findByPk = async () => user
  await requirePermission(permission)(request, {}, next)
  return { request, receivedError }
}

test.afterEach(() => {
  db.User.findByPk = originalFindByPk
})

test('allows a user with the required permission', async () => {
  const result = await runMiddleware('employee.read', {
    id: 'user-1',
    status: true,
    role: {
      name: 'HR',
      status: true,
      permissions: [{ key: 'employee.read' }]
    }
  })

  assert.equal(result.receivedError, undefined)
  assert.equal(result.request.user.role, 'HR')
})

test('rejects a user without the required permission', async () => {
  const result = await runMiddleware('employee.delete', {
    id: 'user-1',
    status: true,
    role: {
      name: 'HR',
      status: true,
      permissions: [{ key: 'employee.read' }]
    }
  })

  assert.equal(result.receivedError.statusCode, 403)
  assert.match(result.receivedError.message, /employee.delete/)
})

test('rejects an inactive role', async () => {
  const result = await runMiddleware('employee.read', {
    id: 'user-1',
    status: true,
    role: {
      name: 'HR',
      status: false,
      permissions: [{ key: 'employee.read' }]
    }
  })

  assert.equal(result.receivedError.statusCode, 403)
})

test('accepts any permission from a list and exposes employee context', async () => {
  const result = await runMiddleware(
    ['leave_request.decide', 'leave_request.decide_direct_report'],
    {
      id: 'user-1',
      status: true,
      employee_id: 'emp-1',
      role: {
        name: 'EMPLOYEE',
        status: true,
        permissions: [{ key: 'leave_request.decide_direct_report' }]
      }
    }
  )

  assert.equal(result.receivedError, undefined)
  assert.equal(result.request.user.employeeId, 'emp-1')
  assert.deepEqual(result.request.user.permissions, ['leave_request.decide_direct_report'])
})

test('rejects a user who has none of the listed permissions', async () => {
  const result = await runMiddleware(
    ['leave_request.decide', 'leave_request.decide_direct_report'],
    {
      id: 'user-1',
      status: true,
      role: {
        name: 'EMPLOYEE',
        status: true,
        permissions: [{ key: 'leave_request.read' }]
      }
    }
  )

  assert.equal(result.receivedError.statusCode, 403)
  assert.match(result.receivedError.message, /leave_request\.decide \| leave_request\.decide_direct_report/)
})
