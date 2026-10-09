'use strict'
const cuid = require('cuid')
module.exports = {
  async up (queryInterface, Sequelize) {
    const roles = await queryInterface.sequelize.query(
      'SELECT id, name FROM roles',
      { type: Sequelize.QueryTypes.SELECT }
    )
    const permissions = await queryInterface.sequelize.query(
      'SELECT id, key FROM permissions',
      { type: Sequelize.QueryTypes.SELECT }
    )
    const existingRows = await queryInterface.sequelize.query(
      'SELECT role_id, permission_id FROM role_permissions',
      { type: Sequelize.QueryTypes.SELECT }
    )
    const existing = new Set(existingRows.map((row) => `${row.role_id}:${row.permission_id}`))
    const permissionByKey = new Map(permissions.map((permission) => [permission.key, permission.id]))
    const allKeys = permissions.map((permission) => permission.key)
    const roleKeys = {
      ADMIN: allKeys,
      HR: allKeys.filter((key) => !['role.delete', 'user.delete', 'employee.delete', 'department.delete'].includes(key)),
      EMPLOYEE: ['dashboard.read', 'employee.read']
    }
    const now = new Date()
    const rows = []

    for (const role of roles) {
      for (const key of roleKeys[role.name] || []) {
        const permissionId = permissionByKey.get(key)
        if (permissionId && !existing.has(`${role.id}:${permissionId}`)) {
          rows.push({ id: cuid(), role_id: role.id, permission_id: permissionId, created_at: now, updated_at: now })
        }
      }
    }

    if (rows.length) await queryInterface.bulkInsert('role_permissions', rows)
  },
  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('role_permissions', null, {})
  }
};