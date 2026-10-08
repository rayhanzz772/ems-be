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
      userId: {
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
      entityId: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'entity_id'
      },
      oldData: {
        type: DataTypes.JSONB,
        allowNull: true,
        field: 'old_data'
      },
      newData: {
        type: DataTypes.JSONB,
        allowNull: true,
        field: 'new_data'
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'created_at'
      }
    },
    {
      sequelize,
      modelName: 'AuditLog',
      tableName: 'auditlogs',
      timestamps: true,
      underscored: true,
      updatedAt: false
    }
  )
  return AuditLog
}
