'use strict'
const { Model } = require('sequelize')
const cuid = require('cuid')
module.exports = (sequelize, DataTypes) => {
  class Position extends Model {
    static associate(models) {
      Position.hasMany(models.Employee, {
        foreignKey: 'position_id',
        as: 'employees'
      })
    }
  }

  Position.init(
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
      description: {
        type: DataTypes.STRING,
        allowNull: false
      },
      created_at: {
        allowNull: false,
        type: DataTypes.DATE
      },
      updated_at: {
        allowNull: false,
        type: DataTypes.DATE
      }
    },
    {
      sequelize,
      modelName: 'Position',
      tableName: 'positions',
      underscored: true
    }
  )
  return Position
}
