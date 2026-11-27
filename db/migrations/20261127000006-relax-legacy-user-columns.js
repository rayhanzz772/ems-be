'use strict'

/**
 * DB lama masih membawa kolom `users.username` (dan mungkin `users.name`) dari
 * skema sebelum login berbasis email. Repo tidak memakai keduanya, tetapi
 * kolomnya masih NOT NULL sehingga insert user gagal. Dibuat nullable tanpa
 * menghapus data lama.
 */
const relaxColumn = async (queryInterface, table, column) => {
  let described
  try {
    described = await queryInterface.describeTable(table)
  } catch (error) {
    return
  }

  const info = described[column]
  if (!info || info.allowNull !== false) return

  await queryInterface.sequelize.query(
    `ALTER TABLE "${table}" ALTER COLUMN "${column}" DROP NOT NULL`
  )
}

module.exports = {
  async up (queryInterface) {
    await relaxColumn(queryInterface, 'users', 'name')
    await relaxColumn(queryInterface, 'users', 'username')
  },

  async down () {
    // Sengaja no-op: baris yang sudah NULL tidak bisa dibedakan lagi.
  }
}
