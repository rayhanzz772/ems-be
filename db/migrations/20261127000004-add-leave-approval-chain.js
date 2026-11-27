'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('leave_requests', 'current_level', {
      type: Sequelize.STRING(20),
      allowNull: true
    })
    await queryInterface.addColumn('leave_requests', 'level_1_employee_id', {
      type: Sequelize.STRING,
      allowNull: true,
      references: { model: 'employees', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    })
    await queryInterface.addColumn('leave_requests', 'level_1_decided_by', {
      type: Sequelize.STRING,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    })
    await queryInterface.addColumn('leave_requests', 'level_1_decided_at', {
      type: Sequelize.DATE,
      allowNull: true
    })
    await queryInterface.addColumn('leave_requests', 'level_1_note', {
      type: Sequelize.TEXT,
      allowNull: true
    })
    await queryInterface.addColumn('leave_requests', 'level_2_decided_by', {
      type: Sequelize.STRING,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    })
    await queryInterface.addColumn('leave_requests', 'level_2_decided_at', {
      type: Sequelize.DATE,
      allowNull: true
    })
    await queryInterface.addColumn('leave_requests', 'level_2_note', {
      type: Sequelize.TEXT,
      allowNull: true
    })
    await queryInterface.addColumn('leave_requests', 'escalated_at', {
      type: Sequelize.DATE,
      allowNull: true
    })

    await queryInterface.addIndex('leave_requests', ['current_level', 'status'])

    // Permohonan yang masih menggantung dipertahankan di LEVEL_2 (HR) supaya
    // bisa diputuskan tanpa error, lalu yang punya atasan aktif dipindah ke LEVEL_1.
    await queryInterface.sequelize.query(
      "UPDATE \"leave_requests\" SET \"current_level\" = 'LEVEL_2' WHERE \"status\" = 'PENDING'"
    )

    await queryInterface.sequelize.query(`
      UPDATE "leave_requests" AS lr
      SET "current_level" = 'LEVEL_1',
          "level_1_employee_id" = e."manager_id"
      FROM "employees" AS e
      JOIN "employees" AS m ON m."id" = e."manager_id"
      WHERE lr."employee_id" = e."id"
        AND lr."status" = 'PENDING'
        AND m."status" = true
        AND m."employment_status" = 'ACTIVE'
        AND m."id" <> e."id"
    `)

    // Baris historis dibiarkan current_level NULL: diputuskan dengan aturan lama.
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('leave_requests', ['current_level', 'status'])
    for (const column of [
      'escalated_at',
      'level_2_note',
      'level_2_decided_at',
      'level_2_decided_by',
      'level_1_note',
      'level_1_decided_at',
      'level_1_decided_by',
      'level_1_employee_id',
      'current_level'
    ]) {
      await queryInterface.removeColumn('leave_requests', column)
    }
  }
}
