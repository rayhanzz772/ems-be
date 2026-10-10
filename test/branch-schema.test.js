const test = require('node:test')
const assert = require('node:assert/strict')

const {
  createBranchSchema,
  updateBranchSchema
} = require('../src/modules/branch/schema')

test('branch creation trims and validates required name', () => {
  assert.deepEqual(createBranchSchema.parse({
    name: '  Head Office ',
    address: '  Jakarta '
  }), {
    name: 'Head Office',
    address: 'Jakarta'
  })

  assert.equal(createBranchSchema.safeParse({ name: '  ' }).success, false)
  assert.equal(createBranchSchema.safeParse({ name: 'A'.repeat(256) }).success, false)
})

test('branch address can be omitted or cleared with null', () => {
  assert.deepEqual(createBranchSchema.parse({ name: 'Branch' }), {
    name: 'Branch'
  })
  assert.deepEqual(updateBranchSchema.parse({ address: null }), {
    address: null
  })
})

test('branch update requires at least one valid field', () => {
  assert.equal(updateBranchSchema.safeParse({}).success, false)
  assert.equal(updateBranchSchema.safeParse({ name: '' }).success, false)
  assert.deepEqual(updateBranchSchema.parse({ status: false }), {
    status: false
  })
})
