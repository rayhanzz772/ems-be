'use strict'
const { Model } = require('sequelize')
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
        allowNull: false,
        primaryKey: true
      },
      employeeCode: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        field: 'employee_code'
      },
      firstName: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'first_name'
      },
      lastName: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'last_name'
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
      },
      phoneNumber: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'phone_number'
      },
      departmentId: {
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
      hireDate: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'hire_date'
      },
      address: {
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
      },
      deletedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'deleted_at'
      }
    },
    {
      sequelize,
      modelName: 'Employee',
      tableName: 'employees',
      timestamps: true,
      underscored: true,
      paranoid: true
    }
  )
  return Employee
}
