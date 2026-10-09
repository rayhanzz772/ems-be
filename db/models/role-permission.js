'use strict'
const { Model } = require('sequelize')
const cuid = require('cuid')
module.exports = (sequelize, DataTypes) => {
  class RolePermission extends Model {
      static associate(models) {
      RolePermission.belongsTo(models.Role, {
        foreignKey: 'role_id',
        as: 'role'
      })
      RolePermission.belongsTo(models.Permission, {
        foreignKey: 'permission_id',
        as: 'permission'
      })
    }
  }

  RolePermission.init(
    {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
        defaultValue: cuid,
        allowNull: false
      },
      role_id: {
        type: DataTypes.STRING,
        allowNull: false
      },
      permission_id: {
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
      modelName: 'RolePermission',
      tableName: 'role_permissions',
      underscored: true
    }
  )
  return RolePermission;
}
