'use strict'
const { Model } = require('sequelize')
const cuid = require('cuid')
module.exports = (sequelize, DataTypes) => {
  class Branch extends Model {
      static associate(models) {
      Branch.hasMany(models.Employee, {
        foreignKey: 'branch_id',
        as: 'employees'
      })
    }
  }

  Branch.init(
    {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
        defaultValue: () => cuid()
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      address: {
        type: DataTypes.STRING,
        allowNull: true
      },
      status: {
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
      modelName: 'Branch',
      tableName: 'branches',
      underscored: true
    }
  )
  return Branch;
}
