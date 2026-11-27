'use strict'
const { Model } = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  class JobRun extends Model {}

  JobRun.init(
    {
      id: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false
      },
      started_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'started_at'
      },
      finished_at: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'finished_at'
      },
      error: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      detail: {
        type: DataTypes.JSONB,
        allowNull: true
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
      modelName: 'JobRun',
      tableName: 'job_runs',
      underscored: true,
      updatedAt: false
    }
  )
  return JobRun
}
