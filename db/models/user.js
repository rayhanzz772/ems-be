'use strict'
const { Model } = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      User.hasMany(models.AuditLog, {
        foreignKey: 'user_id',
        as: 'auditLogs'
      })
      User.belongsTo(models.Role, {
        foreignKey: 'role_id',
        as: 'role'
      })
    }
  }

  User.init(
    {
      id: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false
      },
      role_id: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'role_id',
        references: {
          model: 'roles',
          key: 'id'
        }
      },
      status: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false
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
      modelName: 'User',
      tableName: 'users',
      underscored: true,
      paranoid: true
    }
  )
  return User
}
