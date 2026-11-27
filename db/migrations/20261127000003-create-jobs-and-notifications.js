'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('job_runs', {
      id: {
        type: Sequelize.STRING,
        allowNull: false,
        primaryKey: true
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false
      },
      started_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      finished_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      error: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      detail: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    })

    // Lock antar proses: hanya satu RUNNING per nama job.
    await queryInterface.sequelize.query(
      'CREATE UNIQUE INDEX "job_runs_running_name_unique" ON "job_runs" ("name") WHERE "status" = \'RUNNING\''
    )

    await queryInterface.createTable('notifications', {
      id: {
        type: Sequelize.STRING,
        allowNull: false,
        primaryKey: true
      },
      user_id: {
        type: Sequelize.STRING,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      employee_id: {
        type: Sequelize.STRING,
        allowNull: true,
        references: {
          model: 'employees',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      type: {
        type: Sequelize.STRING,
        allowNull: false
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false
      },
      body: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      entity_type: {
        type: Sequelize.STRING,
        allowNull: true
      },
      entity_id: {
        type: Sequelize.STRING,
        allowNull: true
      },
      data: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      read_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true
      }
    })

    await queryInterface.addIndex('notifications', ['user_id', 'created_at'])
    await queryInterface.addIndex('notifications', ['read_at'])

    await queryInterface.createTable('notification_outbox', {
      id: {
        type: Sequelize.STRING,
        allowNull: false,
        primaryKey: true
      },
      notification_id: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'notifications',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      channel: {
        type: Sequelize.STRING,
        allowNull: false
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'PENDING'
      },
      attempts: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      last_error: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      next_attempt_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      sent_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    })

    await queryInterface.addIndex('notification_outbox', ['status', 'next_attempt_at'])
  },

  async down(queryInterface) {
    await queryInterface.dropTable('notification_outbox')
    await queryInterface.dropTable('notifications')
    await queryInterface.dropTable('job_runs')
  }
}
