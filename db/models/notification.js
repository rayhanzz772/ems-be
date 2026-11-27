'use strict'
const { Model } = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  class Notification extends Model {
    static associate(models) {
      Notification.belongsTo(models.User, {
        foreignKey: 'user_id',
        as: 'user'
      })
      Notification.belongsTo(models.Employee, {
        foreignKey: 'employee_id',
        as: 'employee'
      })
      Notification.hasMany(models.NotificationOutbox, {
        foreignKey: 'notification_id',
        as: 'deliveries'
      })
    }
  }

  Notification.init(
    {
      id: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true
      },
      user_id: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'user_id',
        references: {
          model: 'users',
          key: 'id'
        }
      },
      employee_id: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'employee_id',
        references: {
          model: 'employees',
          key: 'id'
        }
      },
      type: {
        type: DataTypes.STRING,
        allowNull: false
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false
      },
      body: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      entity_type: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'entity_type'
      },
      entity_id: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'entity_id'
      },
      data: {
        type: DataTypes.JSONB,
        allowNull: true
      },
      read_at: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'read_at'
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
      modelName: 'Notification',
      tableName: 'notifications',
      underscored: true,
      paranoid: true
    }
  )
  return Notification
}
