'use strict'
const { Model } = require('sequelize')
const cuid = require('cuid')
module.exports = (sequelize, DataTypes) => {
  class Employee extends Model {
    static associate(models) {
      Employee.belongsTo(models.Department, {
        foreignKey: 'department_id',
        as: 'department'
      })
    }
  }

  Employee.init(
    {
      id: {
        type: DataTypes.STRING,
        defaultValue: cuid,
        allowNull: false,
        primaryKey: true
      },
      employee_code: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'employee_code'
      },
      first_name: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'first_name'
      },
      last_name: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'last_name'
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false
      },
      phone_number: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'phone_number'
      },
      department_id: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'department_id',
        references: {
          model: 'departments',
          key: 'id'
        }
      },
      position: {
        type: DataTypes.STRING,
        allowNull: false
      },
      status: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      hire_date: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'hire_date'
      },
      address: {
        type: DataTypes.STRING,
        allowNull: true
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'created_at'
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'updated_at'
      },
      deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'deleted_at'
      }
    },
    {
      sequelize,
      modelName: 'Employee',
      tableName: 'employees',
      underscored: true,
      paranoid: true
    }
  )
  return Employee
}
