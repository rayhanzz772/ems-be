'use strict'
const { Model } = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  class AuditLog extends Model {
    static associate(models) {
      AuditLog.belongsTo(models.User, {
        foreignKey: 'user_id',
        as: 'user'
      })
    }
  }

  AuditLog.init(
    {
      id: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true
      },
      user_id: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'user_id',
        references: {
          model: 'users',
          key: 'id'
        }
      },
      action: {
        type: DataTypes.ENUM('CREATE', 'UPDATE', 'DELETE'),
        allowNull: false
      },
      entity: {
        type: DataTypes.STRING,
        allowNull: false
      },
      entity_id: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'entity_id'
      },
      old_data: {
        type: DataTypes.JSONB,
        allowNull: true,
        field: 'old_data'
      },
      new_data: {
        type: DataTypes.JSONB,
        allowNull: true,
        field: 'new_data'
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'created_at'
      }
    },
    {
      sequelize,
      modelName: 'AuditLog',
      tableName: 'audit_logs',
      timestamps: true,
      underscored: true,
      updatedAt: false
    }
  )
  return AuditLog
}
