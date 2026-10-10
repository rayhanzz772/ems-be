'use strict'

const cuid = require('cuid')

const branchPermissions = [
  ['branch.read', 'read', 'View branches'],
  ['branch.create', 'create', 'Create branches'],
  ['branch.update', 'update', 'Update branches'],
  ['branch.delete', 'delete', 'Delete branches']
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

    for (const [key, action, description] of branchPermissions) {
      if (!permissionIds.has(key)) {
        const id = cuid()
        await queryInterface.bulkInsert('permissions', [{
          id,
          key,
          resource: 'branch',
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
      const allowedActions = role.name === 'ADMIN'
        ? ['read', 'create', 'update', 'delete']
        : role.name === 'HR'
          ? ['read', 'create', 'update']
          : role.name === 'EMPLOYEE'
            ? ['read']
            : []

      for (const [key, action] of branchPermissions) {
        const permissionId = permissionIds.get(key)
        if (
          allowedActions.includes(action) &&
          permissionId &&
          !assignments.has(`${role.id}:${permissionId}`)
        ) {
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

    if (rows.length) {
      await queryInterface.bulkInsert('role_permissions', rows)
    }
  },

  async down(queryInterface, Sequelize) {
    const keys = branchPermissions.map(([key]) => key)
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
