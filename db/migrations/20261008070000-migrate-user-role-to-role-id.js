'use strict';

const cuid = require('cuid')

module.exports = {
  async up (queryInterface, Sequelize) {
    const describeUsers = async () => {
      try {
        return await queryInterface.describeTable('users')
      } catch (error) {
        return null
      }
    }

    const describeRoles = async () => {
      try {
        return await queryInterface.describeTable('roles')
      } catch (error) {
        return null
      }
    }

    const usersTable = await describeUsers()
    const rolesTable = await describeRoles()

    if (!usersTable) {
      return
    }

    if (!rolesTable) {
      await queryInterface.createTable('roles', {
        id: {
          type: Sequelize.STRING,
          allowNull: false,
          primaryKey: true,
          defaultValue: () => cuid()
        },
        name: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true
        },
        description: {
          type: Sequelize.STRING,
          allowNull: true
        },
        status: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        deleted_at: {
          type: Sequelize.DATE,
          allowNull: true
        }
      })
    }

    const roleRows = await queryInterface.sequelize.query(
      'SELECT id, name FROM roles',
      { type: Sequelize.QueryTypes.SELECT }
    )
    const roleMap = Object.fromEntries(roleRows.map((role) => [role.name, role.id]))

    const defaultRoles = [
      { id: cuid(), name: 'ADMIN', description: 'Administrator with full access', status: true },
      { id: cuid(), name: 'HR', description: 'Human resources user', status: true },
      { id: cuid(), name: 'EMPLOYEE', description: 'Standard employee user', status: true }
    ]

    for (const role of defaultRoles) {
      if (!roleMap[role.name]) {
        await queryInterface.bulkInsert('roles', [{
          id: role.id,
          name: role.name,
          description: role.description,
          status: role.status,
          created_at: new Date(),
          updated_at: new Date()
        }])
        roleMap[role.name] = role.id
      }
    }

    if (!usersTable.role_id) {
      await queryInterface.addColumn('users', 'role_id', {
        type: Sequelize.STRING,
        allowNull: true,
        references: {
          model: 'roles',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      })
    }

    const users = await queryInterface.sequelize.query(
      'SELECT id, role FROM users WHERE role IS NOT NULL',
      { type: Sequelize.QueryTypes.SELECT }
    )

    for (const user of users) {
      const roleName = String(user.role).toUpperCase()
      const targetRoleId = roleMap[roleName]

      if (targetRoleId) {
        await queryInterface.sequelize.query(
          'UPDATE users SET role_id = :roleId WHERE id = :userId',
          {
            replacements: {
              roleId: targetRoleId,
              userId: user.id
            }
          }
        )
      }
    }

    if (usersTable.role) {
      await queryInterface.removeColumn('users', 'role')
    }

    await queryInterface.sequelize.query(
      'UPDATE users SET role_id = :roleId WHERE role_id IS NULL',
      {
        replacements: { roleId: roleMap.EMPLOYEE }
      }
    )

    await queryInterface.changeColumn('users', 'role_id', {
      type: Sequelize.STRING,
      allowNull: false,
      references: {
        model: 'roles',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    })
  },

  async down (queryInterface, Sequelize) {
    const usersTable = await queryInterface.describeTable('users').catch(() => null)
    if (!usersTable) return

    if (!usersTable.role) {
      await queryInterface.addColumn('users', 'role', {
        type: Sequelize.ENUM('ADMIN', 'HR', 'EMPLOYEE'),
        allowNull: true,
        defaultValue: 'EMPLOYEE'
      })
    }

    const rows = await queryInterface.sequelize.query(
      `SELECT u.id, r.name AS role_name
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id`,
      { type: Sequelize.QueryTypes.SELECT }
    )

    for (const row of rows) {
      if (row.role_name) {
        await queryInterface.sequelize.query(
          'UPDATE users SET role = :roleName WHERE id = :userId',
          {
            replacements: {
              roleName: row.role_name,
              userId: row.id
            }
          }
        )
      }
    }

    if (usersTable.role_id) {
      await queryInterface.removeColumn('users', 'role_id')
    }
  }
}
