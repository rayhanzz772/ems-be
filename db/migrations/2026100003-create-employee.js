'use strict';
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('employees', {
      id: {
        type: Sequelize.STRING,
        allowNull: false,
        primaryKey: true
      },
      employee_code: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      first_name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      last_name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      phone_number: {
        type: Sequelize.STRING,
        allowNull: true
      },
      department_id: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'departments',
          key: 'id'
        }
      },
      status: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      hire_date: {
        type: Sequelize.DATE,
        allowNull: false
      },
      address: {
        type: Sequelize.STRING,
        allowNull: true
      },
      position_id: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'positions',
          key: 'id'
        }
      },
      manager_id: {
        type: Sequelize.STRING,
        allowNull: true,
        references: {
          model: 'employees',
          key: 'id'
        }
      },
      branch_id: {
        type: Sequelize.STRING,
        allowNull: true,
        references: {
          model: 'branches',
          key: 'id'
        }
      },
      employment_type: {
        type: Sequelize.ENUM('PERMANENT', 'CONTRACT', 'INTERN'),
        allowNull: false,
        defaultValue: 'PERMANENT'
      },
      employment_status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'ACTIVE'
      },
      contract_start_date: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      contract_end_date: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE
      },
      deleted_at: {
        allowNull: true,
        type: Sequelize.DATE
      }
    })

  },
  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('employees')
  }
}