'use strict'
const cuid = require('cuid')

module.exports = {
  async up (queryInterface, Sequelize) {
    const now = new Date()
    const [departments] = await queryInterface.sequelize.query(
      'SELECT id FROM departments ORDER BY created_at ASC LIMIT 1',
      { type: Sequelize.QueryTypes.SELECT }
    )

    const num = Math.floor(Math.random() * 100)
    const departmentId = departments?.id || cuid()

    await queryInterface.bulkInsert('employees', [
      {
        id: cuid(),
        employee_code: `EMP${num}`,
        first_name: 'John',
        last_name: 'Doe',
        email: 'john2.doe@company.com',
        phone_number: '081234567890',
        department_id: departmentId,
        position: 'Software Engineer',
        status: true,
        hire_date: new Date('2024-01-15'),
        address: 'Jakarta Selatan',
        created_at: now,
        updated_at: now
      },
      {
        id: cuid(),
        employee_code: `EMP${num + 1}`,
        first_name: 'Jane',
        last_name: 'Smith',
        email: 'jane2.smith@company.com',
        phone_number: '081234567891',
        department_id: departmentId,
        position: 'HR Specialist',
        status: true,
        hire_date: new Date('2023-05-10'),
        address: 'Bandung',
        created_at: now,
        updated_at: now
      }
    ])
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('employees', null, {})
  }
}