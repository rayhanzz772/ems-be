'use strict'
const { Model } = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  class UserSession extends Model {
    static associate(models) {
      UserSession.belongsTo(models.User, {
        foreignKey: 'user_id',
        as: 'user'
      })
    }
  }

  UserSession.init(
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
      refresh_token_hash: {
        type: DataTypes.STRING(64),
        allowNull: false,
        field: 'refresh_token_hash'
      },
      expires_at: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'expires_at'
      },
      revoked_at: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'revoked_at'
      },
      replaced_by_session_id: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'replaced_by_session_id'
      },
      user_agent: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'user_agent'
      },
      ip_address: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'ip_address'
      },
      last_used_at: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'last_used_at'
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
      modelName: 'UserSession',
      tableName: 'user_sessions',
      underscored: true
    }
  )
  return UserSession
}
