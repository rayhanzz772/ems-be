'use strict'
const cuid = require('cuid')
module.exports = {
  async up (queryInterface, Sequelize) {
    const now = new Date()
    await queryInterface.bulkInsert('branches', [
      {
        id: cuid(),
        name: 'Head Office',
        address: '123 Main Street, Cityville',
        status: true,
        created_at: now,
        updated_at: now
      },
      {
        id: cuid(),
        name: 'Branch Office',
        address: '456 Elm Street, Townsville',
        status: true,
        created_at: now,
        updated_at: now
      }
    ])
  },
  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('branches', null, {})
  }
};