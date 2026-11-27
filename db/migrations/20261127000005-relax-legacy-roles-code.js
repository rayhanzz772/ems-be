'use strict'

/**
 * DB lama masih punya `roles.code` dari skema sebelum role_id diperkenalkan.
 * Skema sekarang tidak memakai kolom itu, tetapi kolomnya masih NOT NULL di
 * sebagian database sehingga insert role (migrasi, seeder, dan POST /roles/create)
 * gagal. Dibuat nullable supaya aman, tanpa menghapus data lama.
 */
module.exports = {
  async up (queryInterface) {
    let rolesTable
    try {
      rolesTable = await queryInterface.describeTable('roles')
    } catch (error) {
      return
    }

    if (!rolesTable.code || rolesTable.code.allowNull !== false) return

    await queryInterface.sequelize.query(
      'UPDATE roles SET code = name WHERE code IS NULL'
    )
    await queryInterface.sequelize.query(
      'ALTER TABLE roles ALTER COLUMN code DROP NOT NULL'
    )
  },

  async down () {
    // Sengaja no-op: baris yang sudah NULL tidak bisa dibedakan lagi.
  }
}
