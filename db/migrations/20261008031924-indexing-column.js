'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addIndex('employees', ['employee_code'], {
      name: 'idx_employees_employee_code'
    })

    await queryInterface.addIndex('employees', ['email'], {
      name: 'idx_employees_email'
    })

    await queryInterface.addIndex('employees', ['department_id'], {
      name: 'idx_employees_department_id'
    })

    await queryInterface.addIndex('employees', ['status'], {
      name: 'idx_employees_status'
    })

    await queryInterface.addIndex('employees', ['created_at'], {
      name: 'idx_employees_created_at'
    })

    await queryInterface.addIndex('employees', ['department_id', 'status'], {
      name: 'idx_employees_department_status'
    })
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeIndex('employees', 'idx_employees_department_status')
    await queryInterface.removeIndex('employees', 'idx_employees_created_at')
    await queryInterface.removeIndex('employees', 'idx_employees_status')
    await queryInterface.removeIndex('employees', 'idx_employees_department_id')
    await queryInterface.removeIndex('employees', 'idx_employees_email')
    await queryInterface.removeIndex('employees', 'idx_employees_employee_code')
  }
};
