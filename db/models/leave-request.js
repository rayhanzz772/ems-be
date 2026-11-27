'use strict'

const { Model } = require('sequelize')
const cuid = require('cuid')

const leaveStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']

module.exports = (sequelize, DataTypes) => {
  class LeaveRequest extends Model {
    static associate(models) {
      LeaveRequest.belongsTo(models.Employee, {
        foreignKey: 'employee_id',
        as: 'employee'
      })
      LeaveRequest.belongsTo(models.LeaveType, {
        foreignKey: 'leave_type_id',
        as: 'leave_type'
      })
      LeaveRequest.belongsTo(models.Employee, {
        foreignKey: 'approver_id',
        as: 'approver'
      })
      LeaveRequest.belongsTo(models.User, {
        foreignKey: 'decided_by',
        as: 'decider'
      })
      LeaveRequest.belongsTo(models.Employee, {
        foreignKey: 'level_1_employee_id',
        as: 'level_1_employee'
      })
      LeaveRequest.belongsTo(models.User, {
        foreignKey: 'level_1_decided_by',
        as: 'level_1_decider'
      })
      LeaveRequest.belongsTo(models.User, {
        foreignKey: 'level_2_decided_by',
        as: 'level_2_decider'
      })
    }
  }

  LeaveRequest.init(
    {
      id: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true,
        defaultValue: () => cuid()
      },
      employee_id: {
        type: DataTypes.STRING,
        allowNull: false,
        references: { model: 'employees', key: 'id' }
      },
      leave_type_id: {
        type: DataTypes.STRING,
        allowNull: false,
        references: { model: 'leave_types', key: 'id' }
      },
      approver_id: {
        type: DataTypes.STRING,
        allowNull: true,
        references: { model: 'employees', key: 'id' }
      },
      current_level: {
        type: DataTypes.STRING(20),
        allowNull: true,
        validate: { isIn: [['LEVEL_1', 'LEVEL_2']] }
      },
      level_1_employee_id: {
        type: DataTypes.STRING,
        allowNull: true,
        references: { model: 'employees', key: 'id' }
      },
      level_1_decided_by: {
        type: DataTypes.STRING,
        allowNull: true,
        references: { model: 'users', key: 'id' }
      },
      level_1_decided_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      level_1_note: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      level_2_decided_by: {
        type: DataTypes.STRING,
        allowNull: true,
        references: { model: 'users', key: 'id' }
      },
      level_2_decided_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      level_2_note: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      escalated_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      start_date: {
        type: DataTypes.DATEONLY,
        allowNull: false
      },
      end_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        validate: {
          isAfterOrEqual(value) {
            if (value < this.start_date) {
              throw new Error('Leave end date must be on or after the start date')
            }
          }
        }
      },
      duration_days: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        validate: { min: 0.01 }
      },
      reason: {
        type: DataTypes.TEXT,
        allowNull: false,
        validate: { notEmpty: true }
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'PENDING',
        validate: { isIn: [leaveStatuses] }
      },
      decision_note: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      decided_by: {
        type: DataTypes.STRING,
        allowNull: true,
        references: { model: 'users', key: 'id' }
      },
      decided_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      }
    },
    {
      sequelize,
      modelName: 'LeaveRequest',
      tableName: 'leave_requests',
      underscored: true
    }
  )

  return LeaveRequest
}
