'use strict'
const cuid = require('cuid')

module.exports = {
  async up (queryInterface, Sequelize) {
    const now = new Date()

    await queryInterface.bulkInsert('departments', [
      {
        id: cuid(),
        name: 'Engineering',
        description: 'Software and product engineering team',
        status: true,
        created_at: now,
        updated_at: now
      },
      {
        id: cuid(),
        name: 'Human Resources',
        description: 'Recruitment, payroll, and employee support',
        status: true,
        created_at: now,
        updated_at: now
      },
      {
        id: cuid(),
        name: 'Finance',
        description: 'Accounting and financial operations',
        status: false,
        created_at: now,
        updated_at: now
      }
    ])
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('departments', null, {})
  }
}