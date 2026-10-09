'use strict'

const table = 'employees'
const column = 'employee_code'
const index = 'employees_employee_code_active_unique'

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

      await queryInterface.addIndex(table, [column], {
        name: index,
        unique: true,
        where: { deleted_at: null },
        transaction
      })
    })
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeIndex(table, index, { transaction })
      await queryInterface.addIndex(table, [column], {
        name: 'employees_employee_code_unique',
        unique: true,
        transaction
      })
    })
  }
}