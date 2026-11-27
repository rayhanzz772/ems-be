'use strict'
const { Model } = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  class NotificationOutbox extends Model {
    static associate(models) {
      NotificationOutbox.belongsTo(models.Notification, {
        foreignKey: 'notification_id',
        as: 'notification'
      })
    }
  }

  NotificationOutbox.init(
    {
      id: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true
      },
      notification_id: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'notification_id',
        references: {
          model: 'notifications',
          key: 'id'
        }
      },
      channel: {
        type: DataTypes.STRING,
        allowNull: false
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'PENDING'
      },
      attempts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      last_error: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'last_error'
      },
      next_attempt_at: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'next_attempt_at'
      },
      sent_at: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'sent_at'
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
      }
    },
    {
      sequelize,
      modelName: 'NotificationOutbox',
      tableName: 'notification_outbox',
      underscored: true
    }
  )
  return NotificationOutbox
}
