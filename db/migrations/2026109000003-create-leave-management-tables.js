'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('leave_types', {
      id: {
        type: Sequelize.STRING,
        allowNull: false,
        primaryKey: true
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      annual_quota: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true
      },
      requires_balance: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      color: {
        type: Sequelize.STRING(7),
        allowNull: false,
        defaultValue: '#2563EB'
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    })

    await queryInterface.createTable('leave_requests', {
      id: {
        type: Sequelize.STRING,
        allowNull: false,
        primaryKey: true
      },
      employee_id: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'employees',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      leave_type_id: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'leave_types',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      approver_id: {
        type: Sequelize.STRING,
        allowNull: true,
        references: {
          model: 'employees',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      start_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      end_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      duration_days: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false
      },
      reason: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'PENDING'
      },
      decision_note: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      decided_by: {
        type: Sequelize.STRING,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      decided_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    })

    await queryInterface.createTable('leave_balances', {
      id: {
        type: Sequelize.STRING,
        allowNull: false,
        primaryKey: true
      },
      employee_id: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'employees',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      leave_type_id: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'leave_types',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      year: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      allocated_days: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0
      },
      adjustment_days: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0
      },
      used_days: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    })

    await queryInterface.addConstraint('leave_balances', {
      fields: ['employee_id', 'leave_type_id', 'year'],
      type: 'unique',
      name: 'leave_balances_employee_type_year_unique'
    })
    await queryInterface.addIndex('leave_requests', ['employee_id', 'status'], {
      name: 'leave_requests_employee_status_idx'
    })
    await queryInterface.addIndex('leave_requests', ['approver_id', 'status'], {
      name: 'leave_requests_approver_status_idx'
    })
    await queryInterface.addIndex('leave_requests', ['start_date', 'end_date'], {
      name: 'leave_requests_date_range_idx'
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('leave_balances')
    await queryInterface.dropTable('leave_requests')
    await queryInterface.dropTable('leave_types')
  }
}
