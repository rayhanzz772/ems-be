'use strict'

const activeEmailIndex = 'users_email_active_unique'

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [constraints] = await queryInterface.sequelize.query(
        `
        SELECT constraint_row.conname
        FROM pg_constraint AS constraint_row
        JOIN pg_attribute AS column_row
          ON column_row.attrelid = constraint_row.conrelid
          AND column_row.attnum = ANY(constraint_row.conkey)
        WHERE constraint_row.conrelid = 'users'::regclass
          AND constraint_row.contype = 'u'
          AND cardinality(constraint_row.conkey) = 1
          AND column_row.attname = 'email'
        `,
        { transaction }
      )

      for (const constraint of constraints) {
        await queryInterface.removeConstraint('users', constraint.conname, { transaction })
      }

      await queryInterface.addIndex('users', ['email'], {
        name: activeEmailIndex,
        unique: true,
        where: { deleted_at: null },
        transaction
      })
    })
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeIndex('users', activeEmailIndex, { transaction })
      await queryInterface.addIndex('users', ['email'], {
        name: 'users_email_unique',
        unique: true,
        transaction
      })
    })
  }
}