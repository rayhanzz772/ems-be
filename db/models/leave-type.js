'use strict'

const { Model } = require('sequelize')
const cuid = require('cuid')

module.exports = (sequelize, DataTypes) => {
  class LeaveType extends Model {
    static associate(models) {
      LeaveType.hasMany(models.LeaveRequest, {
        foreignKey: 'leave_type_id',
        as: 'requests'
      })
      LeaveType.hasMany(models.LeaveBalance, {
        foreignKey: 'leave_type_id',
        as: 'balances'
      })
    }
  }

  LeaveType.init(
    {
      id: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true,
        defaultValue: () => cuid()
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      annual_quota: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        validate: { min: 0 }
      },
      requires_balance: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      color: {
        type: DataTypes.STRING(7),
        allowNull: false,
        defaultValue: '#2563EB'
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
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
      modelName: 'LeaveType',
      tableName: 'leave_types',
      underscored: true
    }
  )

  return LeaveType
}
