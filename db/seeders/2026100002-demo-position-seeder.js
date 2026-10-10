'use strict'

const cuid = require('cuid')

module.exports = {
  async up(queryInterface) {
    const now = new Date()

    await queryInterface.bulkInsert('positions', [
      {
        id: cuid(),
        name: 'Software Engineer',
        description: 'Develops and maintains software applications',
        created_at: now,
        updated_at: now
      },
      {
        id: cuid(),
        name: 'HR Specialist',
        description: 'Supports recruitment and employee relations',
        created_at: now,
        updated_at: now
      },
      {
        id: cuid(),
        name: 'Marketing Manager',
        description: 'Plans and executes marketing strategies',
        created_at: now,
        updated_at: now
      },
      // add 10 more positions as needed
      {
        id: cuid(),
        name: 'Sales Associate',
        description: 'Supports sales activities and customer relations',
        created_at: now,
        updated_at: now
      },
      {
        id: cuid(),
        name: 'Data Analyst',
        description: 'Analyzes data to provide insights and support decision-making',
        created_at: now,
        updated_at: now
      },
      {
        id: cuid(),
        name: 'Project Manager',
        description: 'Oversees project planning and execution',
        created_at: now,
        updated_at: now
      }
    ])
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('positions', null, {})
  }
}
