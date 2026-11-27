const test = require('node:test')
const assert = require('node:assert/strict')

const db = require('../db/models')
const { createAuditLog } = require('../src/utils/auditLog')

const originalCreate = db.AuditLog.create

test.afterEach(() => {
  db.AuditLog.create = originalCreate
})

test('rejects a user action without userId instead of guessing an actor', async () => {
  await assert.rejects(
    () => createAuditLog({ action: 'UPDATE', entity: 'Employee', entityId: 'e-1' }),
    /userId is required/
  )
})

test('rejects a system action without actorLabel', async () => {
  await assert.rejects(
    () => createAuditLog({ actorType: 'SYSTEM', action: 'UPDATE', entity: 'X', entityId: '1' }),
    /actorLabel is required/
  )
})

test('rejects an unknown action instead of relabelling it as CREATE', async () => {
  await assert.rejects(
    () => createAuditLog({ userId: 'u-1', action: 'APPROVE', entity: 'X', entityId: '1' }),
    /Invalid audit action/
  )
})

test('writes system entries with a null user', async () => {
  let written
  db.AuditLog.create = async (payload) => {
    written = payload
    return payload
  }

  await createAuditLog({
    actorType: 'SYSTEM',
    actorLabel: 'scheduler:session-cleanup',
    action: 'DELETE',
    entity: 'UserSession',
    entityId: 's-1'
  })

  assert.equal(written.actor_type, 'SYSTEM')
  assert.equal(written.actor_label, 'scheduler:session-cleanup')
  assert.equal(written.user_id, null)
})

test('writes user entries with the acting user', async () => {
  let written
  db.AuditLog.create = async (payload) => {
    written = payload
    return payload
  }

  await createAuditLog({
    userId: 'u-9',
    action: 'CREATE',
    entity: 'AttendanceLog',
    entityId: 'a-1'
  })

  assert.equal(written.actor_type, 'USER')
  assert.equal(written.user_id, 'u-9')
  assert.equal(written.actor_label, null)
})
