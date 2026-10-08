'use strict'
const cuid = require('cuid')

module.exports = {
  async up (queryInterface, Sequelize) {
    const now = new Date()

    const users = await queryInterface.sequelize.query(
      'SELECT id FROM users ORDER BY created_at ASC LIMIT 1',
      { type: Sequelize.QueryTypes.SELECT }
    )

    const employees = await queryInterface.sequelize.query(
      'SELECT id FROM employees ORDER BY created_at ASC LIMIT 1',
      { type: Sequelize.QueryTypes.SELECT }
    )

    const userId = users[0]?.id || cuid()
    const employeeId = employees[0]?.id || cuid()

    await queryInterface.bulkInsert('audit_logs', [
      {
        id: cuid(),
        user_id: userId,
        action: 'CREATE',
        entity: 'employees',
        entity_id: employeeId,
        old_data: null,
        new_data: JSON.stringify({
          first_name: 'John',
          last_name: 'Doe',
          position: 'Software Engineer'
        }),
        created_at: now
      },
      {
        id: cuid(),
        user_id: userId,
        action: 'UPDATE',
        entity: 'employees',
        entity_id: employeeId,
        old_data: JSON.stringify({
          position: 'Junior Engineer'
        }),
        new_data: JSON.stringify({
          position: 'Software Engineer'
        }),
        created_at: now
      }
    ])
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('audit_logs', null, {})
  }
}