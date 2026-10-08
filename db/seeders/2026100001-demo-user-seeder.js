'use strict'
const cuid = require('cuid')
const argon2 = require('argon2')

module.exports = {
  async up (queryInterface, Sequelize) {
    const now = new Date()

    await queryInterface.bulkInsert('users', [
      {
        id: cuid(),
        email: 'admin@company.com',
        password: await argon2.hash('admin123'),
        created_at: now,
        updated_at: now
      },
      {
        id: cuid(),
        email: 'hr@company.com',
        password: await argon2.hash('hr123456'),
        created_at: now,
        updated_at: now
      }
    ])
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('users', null, {})
  }
}