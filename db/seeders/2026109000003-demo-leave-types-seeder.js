'use strict'

const cuid = require('cuid')

const leaveTypes = [
  {
    name: 'Annual Leave',
    description: 'Paid annual leave with an allocated yearly balance',
    annual_quota: 12,
    requires_balance: true,
    color: '#2563EB'
  },
  {
    name: 'Sick Leave',
    description: 'Leave taken when an employee is unwell',
    annual_quota: null,
    requires_balance: false,
    color: '#F59E0B'
  },
  {
    name: 'Unpaid Leave',
    description: 'Approved leave without pay',
    annual_quota: null,
    requires_balance: false,
    color: '#64748B'
  },
  {
    name: 'Maternity Leave',
    description: 'Leave related to childbirth',
    annual_quota: null,
    requires_balance: false,
    color: '#EC4899'
  },
  {
    name: 'Paternity Leave',
    description: 'Leave for a parent following childbirth',
    annual_quota: null,
    requires_balance: false,
    color: '#8B5CF6'
  }
]

module.exports = {
  async up(queryInterface, Sequelize) {
    const existingRows = await queryInterface.sequelize.query(
      'SELECT name FROM leave_types',
      { type: Sequelize.QueryTypes.SELECT }
    )
    const existingNames = new Set(existingRows.map((leaveType) => leaveType.name))
    const now = new Date()
    const rows = leaveTypes
      .filter((leaveType) => !existingNames.has(leaveType.name))
      .map((leaveType) => ({
        id: cuid(),
        ...leaveType,
        is_active: true,
        created_at: now,
        updated_at: now
      }))

    if (rows.length) {
      await queryInterface.bulkInsert('leave_types', rows)
    }
  },

  async down(queryInterface, Sequelize) {
    const names = leaveTypes.map((leaveType) => leaveType.name)
    const seededTypes = await queryInterface.sequelize.query(
      'SELECT id, name FROM leave_types WHERE name IN (:names)',
      {
        type: Sequelize.QueryTypes.SELECT,
        replacements: { names }
      }
    )
    const seededTypeIds = seededTypes.map((leaveType) => leaveType.id)

    if (!seededTypeIds.length) return

    const [requests, balances] = await Promise.all([
      queryInterface.sequelize.query(
        'SELECT leave_type_id FROM leave_requests WHERE leave_type_id IN (:ids)',
        {
          type: Sequelize.QueryTypes.SELECT,
          replacements: { ids: seededTypeIds }
        }
      ),
      queryInterface.sequelize.query(
        'SELECT leave_type_id FROM leave_balances WHERE leave_type_id IN (:ids)',
        {
          type: Sequelize.QueryTypes.SELECT,
          replacements: { ids: seededTypeIds }
        }
      )
    ])
    const referencedTypeIds = new Set([
      ...requests.map((request) => request.leave_type_id),
      ...balances.map((balance) => balance.leave_type_id)
    ])
    const referencedNames = seededTypes
      .filter((leaveType) => referencedTypeIds.has(leaveType.id))
      .map((leaveType) => leaveType.name)

    if (referencedNames.length) {
      throw new Error(
        `Cannot undo leave type seeder: types are referenced by leave requests or balances (${referencedNames.join(', ')})`
      )
    }

    await queryInterface.bulkDelete('leave_types', { id: seededTypeIds })
  }
}
