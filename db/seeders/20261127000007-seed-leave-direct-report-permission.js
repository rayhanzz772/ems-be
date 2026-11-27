'use strict'

const cuid = require('cuid')

const permission = [
  'leave_request.decide_direct_report',
  'leave_request',
  'decide_direct_report',
  'Approve or reject leave requests for direct reports'
]

// Hanya membuat permission. Pemberian ke role dilakukan lewat layar manajemen
// role, sesuai desain RBAC repo ini. Seeder aman dijalankan berulang.
module.exports = {
  async up(queryInterface, Sequelize) {
    const [existing] = await queryInterface.sequelize.query(
      'SELECT id FROM permissions WHERE key = :key',
      {
        type: Sequelize.QueryTypes.SELECT,
        replacements: { key: permission[0] }
      }
    )

    if (existing) return

    const now = new Date()
    await queryInterface.bulkInsert('permissions', [{
      id: cuid(),
      key: permission[0],
      resource: permission[1],
      action: permission[2],
      description: permission[3],
      created_at: now,
      updated_at: now
    }])
  },

  async down(queryInterface, Sequelize) {
    const permissions = await queryInterface.sequelize.query(
      'SELECT id FROM permissions WHERE key = :key',
      {
        type: Sequelize.QueryTypes.SELECT,
        replacements: { key: permission[0] }
      }
    )
    const ids = permissions.map((row) => row.id)
    if (ids.length) {
      await queryInterface.bulkDelete('role_permissions', { permission_id: ids })
    }
    await queryInterface.bulkDelete('permissions', { key: permission[0] })
  }
}
