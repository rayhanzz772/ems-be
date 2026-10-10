'use strict'
const cuid = require('cuid')

module.exports = {
  async up (queryInterface, Sequelize) {
    const now = new Date()
    const [departments] = await queryInterface.sequelize.query(
      'SELECT id FROM departments ORDER BY created_at ASC LIMIT 1',
      { type: Sequelize.QueryTypes.SELECT }
    )

    const [positions] = await queryInterface.sequelize.query(
      'SELECT id FROM positions ORDER BY created_at ASC LIMIT 1',
      { type: Sequelize.QueryTypes.SELECT }
    )

    const [branches] = await queryInterface.sequelize.query(
      'SELECT id FROM branches ORDER BY created_at ASC LIMIT 1',
      { type: Sequelize.QueryTypes.SELECT }
    )

    if (!departments || !positions) {
      throw new Error('Seed at least one department and position before seeding employees')
    }

    const num = Math.floor(Math.random() * 100)
    const departmentId = departments.id
    const positionId = positions.id
    const branchId = branches?.id || null

    await queryInterface.bulkInsert('employees', [
      {
        id: cuid(),
        employee_code: `EMP${num}`,
        first_name: 'John',
        last_name: 'Doe',
        email: 'john2.doe@company.com',
        phone_number: '081234567890',
        department_id: departmentId,
        position_id: positionId,
        manager_id: null,
        branch_id: branchId,
        employment_type: 'CONTRACT',
        employment_status: 'ACTIVE',
        contract_start_date: '2024-01-15',
        contract_end_date: '2027-01-14',
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
        position_id: positionId,
        manager_id: null,
        branch_id: branchId,
        employment_type: 'PERMANENT',
        employment_status: 'ACTIVE',
        contract_start_date: null,
        contract_end_date: null,
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