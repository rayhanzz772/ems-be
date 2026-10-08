'use strict'
const cuid = require('cuid')
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.bulkInsert('employees', [
      {
        id: cuid(),
        // other fields
      }
    ])
  },
  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('employees', null, {})
  }
};