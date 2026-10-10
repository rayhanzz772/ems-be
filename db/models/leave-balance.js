'use strict'

const { Model } = require('sequelize')
const cuid = require('cuid')

module.exports = (sequelize, DataTypes) => {
  class LeaveBalance extends Model {
    static associate(models) {
      LeaveBalance.belongsTo(models.Employee, {
        foreignKey: 'employee_id',
        as: 'employee'
      })
      LeaveBalance.belongsTo(models.LeaveType, {
        foreignKey: 'leave_type_id',
        as: 'leave_type'
      })
    }
  }

  LeaveBalance.init(
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
      year: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: { min: 2000, max: 9999 }
      },
      allocated_days: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0,
        validate: { min: 0 }
      },
      adjustment_days: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0
      },
      used_days: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0,
        validate: { min: 0 }
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
      modelName: 'LeaveBalance',
      tableName: 'leave_balances',
      underscored: true,
      indexes: [{
        unique: true,
        fields: ['employee_id', 'leave_type_id', 'year'],
        name: 'leave_balances_employee_type_year_unique'
      }]
    }
  )

  return LeaveBalance
}
