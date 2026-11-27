'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'employee_id', {
      type: Sequelize.STRING,
      allowNull: true,
      references: {
        model: 'employees',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    })

    // Satu user per karyawan aktif. Partial index supaya user yang di-soft-delete
    // tidak memblokir tautan ulang.
    await queryInterface.sequelize.query(
      'CREATE UNIQUE INDEX "users_employee_id_active_unique" ON "users" ("employee_id") WHERE "deleted_at" IS NULL AND "employee_id" IS NOT NULL'
    )

    await queryInterface.addColumn('audit_logs', 'actor_type', {
      type: Sequelize.ENUM('USER', 'SYSTEM'),
      allowNull: false,
      defaultValue: 'USER'
    })
    await queryInterface.addColumn('audit_logs', 'actor_label', {
      type: Sequelize.STRING,
      allowNull: true
    })
    await queryInterface.changeColumn('audit_logs', 'user_id', {
      type: Sequelize.STRING,
      allowNull: true
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('audit_logs', 'actor_label')
    await queryInterface.removeColumn('audit_logs', 'actor_type')
    await queryInterface.changeColumn('audit_logs', 'user_id', {
      type: Sequelize.STRING,
      allowNull: false
    })
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS "users_employee_id_active_unique"')
    await queryInterface.removeColumn('users', 'employee_id')
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_audit_logs_actor_type"')
  }
}
