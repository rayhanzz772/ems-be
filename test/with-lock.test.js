const test = require('node:test')
const assert = require('node:assert/strict')

const db = require('../db/models')
const withLock = require('../src/jobs/withLock')

const originalUpdate = db.JobRun.update
const originalCreate = db.JobRun.create

test.afterEach(() => {
  db.JobRun.update = originalUpdate
  db.JobRun.create = originalCreate
})

const fakeRun = (captured) => ({
  update: async (patch) => {
    captured.push(patch)
  }
})

test('skips a job when the same job is already running', async () => {
  db.JobRun.update = async () => [0]
  db.JobRun.create = async () => {
    const err = new Error('duplicate key value violates unique constraint')
    err.name = 'SequelizeUniqueConstraintError'
    throw err
  }

  let ran = false
  const result = await withLock('session-cleanup', async () => {
    ran = true
  })

  assert.equal(result.skipped, true)
  assert.equal(ran, false)
})

test('marks a successful run and returns its detail', async () => {
  const captured = []
  db.JobRun.update = async () => [0]
  db.JobRun.create = async () => fakeRun(captured)

  const result = await withLock('outbox-drain', async () => ({ sent: 2 }))

  assert.equal(result.skipped, false)
  assert.deepEqual(result.detail, { sent: 2 })
  assert.equal(captured.at(-1).status, 'SUCCESS')
})

test('marks a failed run and rethrows', async () => {
  const captured = []
  db.JobRun.update = async () => [0]
  db.JobRun.create = async () => fakeRun(captured)

  await assert.rejects(
    () => withLock('outbox-drain', async () => { throw new Error('smtp down') }),
    /smtp down/
  )

  assert.equal(captured.at(-1).status, 'FAILED')
  assert.match(captured.at(-1).error, /smtp down/)
})
