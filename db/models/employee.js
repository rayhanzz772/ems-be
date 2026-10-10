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
      Employee.belongsTo(models.Position, {
        foreignKey: 'position_id',
        as: 'position'
      })
      Employee.belongsTo(models.Employee, {
        foreignKey: 'manager_id',
        as: 'manager'
      })
      Employee.hasMany(models.Employee, {
        foreignKey: 'manager_id',
        as: 'direct_reports'
      })
      Employee.belongsTo(models.Branch, {
        foreignKey: 'branch_id',
        as: 'branch'
      })
      Employee.hasMany(models.LeaveRequest, {
        foreignKey: 'employee_id',
        as: 'leave_requests'
      })
      Employee.hasMany(models.LeaveRequest, {
        foreignKey: 'approver_id',
        as: 'leave_approvals'
      })
      Employee.hasMany(models.LeaveBalance, {
        foreignKey: 'employee_id',
        as: 'leave_balances'
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
      branch_id: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'branch_id',
        references: {
          model: 'branches',
          key: 'id'
        }
      },
      position_id: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'position_id',
        references: {
          model: 'positions',
          key: 'id'
        }
      },
      manager_id: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'manager_id',
        references: {
          model: 'employees',
          key: 'id'
        }
      },
      employment_type: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'PERMANENT',
        field: 'employment_type'
      },
      employment_status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'ACTIVE',
        field: 'employment_status'
      },
      contract_start_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'contract_start_date'
      },
      contract_end_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'contract_end_date'
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
