'use strict'
const cuid = require('cuid')
module.exports = {
  async up (queryInterface, Sequelize) {
    const permissions = [
      ['dashboard.read', 'dashboard', 'read', 'View dashboard'],
      ['user.read', 'user', 'read', 'View users'],
      ['user.create', 'user', 'create', 'Create users'],
      ['user.update', 'user', 'update', 'Update users'],
      ['user.delete', 'user', 'delete', 'Delete users'],
      ['role.read', 'role', 'read', 'View roles'],
      ['role.create', 'role', 'create', 'Create roles'],
      ['role.update', 'role', 'update', 'Update roles'],
      ['role.delete', 'role', 'delete', 'Delete roles'],
      ['role.permission.assign', 'role', 'permission.assign', 'Assign permissions to roles'],
      ['department.read', 'department', 'read', 'View departments'],
      ['department.create', 'department', 'create', 'Create departments'],
      ['department.update', 'department', 'update', 'Update departments'],
      ['department.delete', 'department', 'delete', 'Delete departments'],
      ['employee.read', 'employee', 'read', 'View employees'],
      ['employee.create', 'employee', 'create', 'Create employees'],
      ['employee.update', 'employee', 'update', 'Update employees'],
      ['employee.delete', 'employee', 'delete', 'Delete employees'],
      ['employee.export', 'employee', 'export', 'Export employees'],
      ['audit_log.read', 'audit_log', 'read', 'View audit logs'],
      ['audit_log.export', 'audit_log', 'export', 'Export audit logs']
    ]
    const existingRows = await queryInterface.sequelize.query(
      'SELECT key FROM permissions',
      { type: Sequelize.QueryTypes.SELECT }
    )
    const existingKeys = new Set(existingRows.map((permission) => permission.key))
    const now = new Date()
    const rows = permissions
      .filter(([key]) => !existingKeys.has(key))
      .map(([key, resource, action, description]) => ({
        id: cuid(), key, resource, action, description, created_at: now, updated_at: now
      }))

    if (rows.length) await queryInterface.bulkInsert('permissions', rows)
  },
  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('permissions', null, {})
  }
};