'use strict'
const { Model } = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  class Department extends Model {
    static associate(models) {
      Department.hasMany(models.Employee, {
        foreignKey: 'department_id',
        as: 'employees'
      })
    }
  }

  Department.init(
    {
      id: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      description: {
        type: DataTypes.STRING,
        allowNull: true
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'created_at'
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'updated_at'
      }
    },
    {
      sequelize,
      modelName: 'Department',
      tableName: 'departments',
      timestamps: true,
      underscored: true
    }
  )
  return Department
}
