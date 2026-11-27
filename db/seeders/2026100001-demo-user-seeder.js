'use strict'
const cuid = require('cuid')
const argon2 = require('argon2')

module.exports = {
  async up (queryInterface, Sequelize) {
    const now = new Date()
    const userColumns = await queryInterface.describeTable('users')
    const roles = await queryInterface.sequelize.query(
      `SELECT id, name FROM roles`,
      { type: Sequelize.QueryTypes.SELECT }
    )
    const roleMap = Object.fromEntries(roles.map((role) => [role.name, role.id]))
    const existingUsers = await queryInterface.sequelize.query(
      `SELECT email FROM users`,
      { type: Sequelize.QueryTypes.SELECT }
    )
    const existingEmails = new Set(existingUsers.map((user) => user.email))
    const usersToInsert = [
      {
        id: cuid(),
        email: 'admin@company.com',
        role_id: roleMap.ADMIN,
        status: true,
        password: await argon2.hash('admin123'),
        created_at: now,
        updated_at: now
      },
      {
        id: cuid(),
        email: 'hr@company.com',
        role_id: roleMap.HR,
        status: true,
        password: await argon2.hash('hr123456'),
        created_at: now,
        updated_at: now
      }
    ]
      .filter((user) => !existingEmails.has(user.email))
      // DB lama masih punya users.username / users.name NOT NULL yang tidak ada
      // di skema sekarang. Isi hanya bila kolomnya benar-benar ada.
      .map((user) => ({
        ...user,
        ...(userColumns.username ? { username: user.email.split('@')[0] } : {}),
        ...(userColumns.name
          ? { name: user.role_id === roleMap.ADMIN ? 'Demo Admin' : 'Demo HR' }
          : {})
      }))

    if (usersToInsert.length) {
      await queryInterface.bulkInsert('users', usersToInsert)
    }
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('users', null, {})
  }
}