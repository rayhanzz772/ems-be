'use strict'

const cuid = require('cuid')

const leavePermissions = [
  ['leave_type.read', 'leave_type', 'read', 'View leave types'],
  ['leave_type.create', 'leave_type', 'create', 'Create leave types'],
  ['leave_type.update', 'leave_type', 'update', 'Update leave types'],
  ['leave_type.delete', 'leave_type', 'delete', 'Delete leave types'],
  ['leave_request.read', 'leave_request', 'read', 'View leave requests and calendar'],
  ['leave_request.create', 'leave_request', 'create', 'Create leave requests'],
  ['leave_request.update', 'leave_request', 'update', 'Update or cancel leave requests'],
  ['leave_request.delete', 'leave_request', 'delete', 'Delete pending leave requests'],
  ['leave_request.decide', 'leave_request', 'decide', 'Approve or reject leave requests'],
  ['leave_balance.read', 'leave_balance', 'read', 'View leave balances'],
  ['leave_balance.create', 'leave_balance', 'create', 'Create leave balances'],
  ['leave_balance.update', 'leave_balance', 'update', 'Update leave balances'],
  ['leave_balance.delete', 'leave_balance', 'delete', 'Delete leave balances']
]

module.exports = {
  async up(queryInterface, Sequelize) {
    const existingPermissions = await queryInterface.sequelize.query(
      'SELECT id, key FROM permissions',
      { type: Sequelize.QueryTypes.SELECT }
    )
    const permissionIds = new Map(
      existingPermissions.map((permission) => [permission.key, permission.id])
    )
    const now = new Date()

    for (const [key, resource, action, description] of leavePermissions) {
      if (!permissionIds.has(key)) {
        const id = cuid()
        await queryInterface.bulkInsert('permissions', [{
          id,
          key,
          resource,
          action,
          description,
          created_at: now,
          updated_at: now
        }])
        permissionIds.set(key, id)
      }
    }

    const roles = await queryInterface.sequelize.query(
      'SELECT id, name FROM roles',
      { type: Sequelize.QueryTypes.SELECT }
    )
    const existingAssignments = await queryInterface.sequelize.query(
      'SELECT role_id, permission_id FROM role_permissions',
      { type: Sequelize.QueryTypes.SELECT }
    )
    const assignments = new Set(
      existingAssignments.map((row) => `${row.role_id}:${row.permission_id}`)
    )
    const rows = []

    for (const role of roles) {
      if (!['ADMIN', 'HR'].includes(role.name)) continue
      for (const [key] of leavePermissions) {
        const permissionId = permissionIds.get(key)
        if (permissionId && !assignments.has(`${role.id}:${permissionId}`)) {
          rows.push({
            id: cuid(),
            role_id: role.id,
            permission_id: permissionId,
            created_at: now,
            updated_at: now
          })
        }
      }
    }

    if (rows.length) await queryInterface.bulkInsert('role_permissions', rows)
  },

  async down(queryInterface, Sequelize) {
    const keys = leavePermissions.map(([key]) => key)
    const permissions = await queryInterface.sequelize.query(
      'SELECT id FROM permissions WHERE key IN (:keys)',
      {
        type: Sequelize.QueryTypes.SELECT,
        replacements: { keys }
      }
    )
    const permissionIds = permissions.map((permission) => permission.id)
    if (permissionIds.length) {
      await queryInterface.bulkDelete('role_permissions', {
        permission_id: permissionIds
      })
    }
    await queryInterface.bulkDelete('permissions', { key: keys })
  }
}
