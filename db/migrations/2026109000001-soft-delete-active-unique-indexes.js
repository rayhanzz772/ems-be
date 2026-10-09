'use strict'

const activeUniqueIndexes = [
  { table: 'employees', column: 'email', index: 'employees_email_active_unique' },
  { table: 'roles', column: 'name', index: 'roles_name_active_unique' }
]

async function removeUniqueConstraints(queryInterface, table, column, transaction) {
  const [constraints] = await queryInterface.sequelize.query(
    `
    SELECT constraint_row.conname
    FROM pg_constraint AS constraint_row
    JOIN pg_attribute AS column_row
      ON column_row.attrelid = constraint_row.conrelid
      AND column_row.attnum = ANY(constraint_row.conkey)
    WHERE constraint_row.conrelid = to_regclass(:tableName)
      AND constraint_row.contype = 'u'
      AND cardinality(constraint_row.conkey) = 1
      AND column_row.attname = :columnName
    `,
    {
      replacements: { tableName: table, columnName: column },
      transaction
    }
  )

  for (const constraint of constraints) {
    await queryInterface.removeConstraint(table, constraint.conname, { transaction })
  }
}

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const { table, column, index } of activeUniqueIndexes) {
        await removeUniqueConstraints(queryInterface, table, column, transaction)
        await queryInterface.addIndex(table, [column], {
          name: index,
          unique: true,
          where: { deleted_at: null },
          transaction
        })
      }
    })
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const { table, column, index } of activeUniqueIndexes) {
        await queryInterface.removeIndex(table, index, { transaction })
        await queryInterface.addIndex(table, [column], {
          name: `${table}_${column}_unique`,
          unique: true,
          transaction
        })
      }
    })
  }
}