'use strict'
const cuid = require('cuid')
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.bulkInsert('auditlogs', [
      {
        id: cuid(),
        // other fields
      }
    ])
  },
  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('auditlogs', null, {})
  }
};