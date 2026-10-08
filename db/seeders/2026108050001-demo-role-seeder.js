'use strict'
const cuid = require('cuid')

module.exports = {
  async up (queryInterface, Sequelize) {
    const now = new Date()
    const existingRoles = await queryInterface.sequelize.query(
      `SELECT name FROM roles`,
      { type: Sequelize.QueryTypes.SELECT }
    )
    const existingRoleNames = new Set(existingRoles.map((role) => role.name))
    const rolesToInsert = [
      {
        id: cuid(),
        name: 'ADMIN',
        description: 'Administrator with full access',
        status: true,
        created_at: now,
        updated_at: now
      },
      {
        id: cuid(),
        name: 'HR',
        description: 'Human resources user',
        status: true,
        created_at: now,
        updated_at: now
      },
      {
        id: cuid(),
        name: 'EMPLOYEE',
        description: 'Standard employee user',
        status: true,
        created_at: now,
        updated_at: now
      }
    ].filter((role) => !existingRoleNames.has(role.name))

    if (rolesToInsert.length) {
      await queryInterface.bulkInsert('roles', rolesToInsert)
    }
  },
  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('roles', null, {})
  }
};