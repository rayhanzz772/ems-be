const test = require('node:test')
const assert = require('node:assert/strict')

const {
  createEmployeeSchema,
  updateEmployeeSchema
} = require('../src/modules/employee/schema')

const validEmployee = {
  employee_code: 'EMP001',
  first_name: 'Ada',
  last_name: 'Lovelace',
  email: 'ada@example.com',
  phone_number: '+628123456789',
  department_id: 'department-1',
  position_id: 'position-1',
  hire_date: '2026-01-01'
}

test('employee creation defaults employment details and manager', () => {
  const employee = createEmployeeSchema.parse(validEmployee)

  assert.equal(employee.manager_id, null)
  assert.equal(employee.employment_type, 'PERMANENT')
  assert.equal(employee.employment_status, 'ACTIVE')
})

test('contract employee requires valid start and end dates', () => {
  assert.equal(
    createEmployeeSchema.safeParse({
      ...validEmployee,
      employment_type: 'CONTRACT'
    }).success,
    false
  )

  assert.equal(
    createEmployeeSchema.safeParse({
      ...validEmployee,
      employment_type: 'CONTRACT',
      contract_start_date: '2026-01-01',
      contract_end_date: '2026-12-31'
    }).success,
    true
  )
})

test('contract end date cannot precede the start date or be an invalid date', () => {
  for (const contractEndDate of ['2025-12-31', '2026-02-30']) {
    assert.equal(
      createEmployeeSchema.safeParse({
        ...validEmployee,
        employment_type: 'CONTRACT',
        contract_start_date: '2026-01-01',
        contract_end_date: contractEndDate
      }).success,
      false
    )
  }
})

test('employment lifecycle status must be supported', () => {
  for (const employmentStatus of ['ACTIVE', 'ON_LEAVE', 'RESIGNED', 'TERMINATED']) {
    assert.equal(
      createEmployeeSchema.safeParse({
        ...validEmployee,
        employment_status: employmentStatus
      }).success,
      true
    )
  }

  assert.equal(
    createEmployeeSchema.safeParse({
      ...validEmployee,
      employment_status: 'UNKNOWN'
    }).success,
    false
  )
})

test('employee update accepts nullable manager and branch references', () => {
  const update = updateEmployeeSchema.parse({ manager_id: null })
  assert.equal(update.manager_id, null)
  assert.equal(update.status, true)
  assert.deepEqual(updateEmployeeSchema.parse({ branch_id: 'branch-1' }), {
    branch_id: 'branch-1',
    status: true
  })
  assert.deepEqual(updateEmployeeSchema.parse({ branch_id: null }), {
    branch_id: null,
    status: true
  })
})

test('employee update normalizes persisted Date values before validation', () => {
  const update = updateEmployeeSchema.parse({
    hire_date: new Date('2024-01-15T07:00:00.000Z'),
    contract_start_date: new Date('2024-01-15T00:00:00.000Z'),
    contract_end_date: new Date('2027-01-14T00:00:00.000Z')
  })

  assert.equal(update.hire_date, '2024-01-15T07:00:00.000Z')
  assert.equal(update.contract_start_date, '2024-01-15')
  assert.equal(update.contract_end_date, '2027-01-14')
})
