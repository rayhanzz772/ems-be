'use strict'

const cuid = require('cuid')

module.exports = {
  async up(queryInterface, Sequelize) {
    const employeeColumns = await queryInterface.describeTable('employees')

    if (!employeeColumns.position_id) {
      await queryInterface.addColumn('employees', 'position_id', {
        type: Sequelize.STRING,
        allowNull: true,
        references: { model: 'positions', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      })
    }

    if (employeeColumns.position) {
      const existingPositions = await queryInterface.sequelize.query(
        'SELECT name FROM positions',
        { type: Sequelize.QueryTypes.SELECT }
      )
      const knownNames = new Set(
        existingPositions.map((position) => position.name.trim().toLowerCase())
      )
      const legacyPositions = await queryInterface.sequelize.query(
        `
        SELECT DISTINCT BTRIM(e.position) AS name
        FROM employees e
        WHERE e.position IS NOT NULL
          AND BTRIM(e.position) <> ''
        `,
        { type: Sequelize.QueryTypes.SELECT }
      )
      const now = new Date()
      const positionsToCreate = []

      for (const { name } of legacyPositions) {
        const normalizedName = name.toLowerCase()
        if (knownNames.has(normalizedName)) continue
        knownNames.add(normalizedName)
        positionsToCreate.push({
          id: cuid(),
          name,
          description: 'Migrated from employee position value',
          created_at: now,
          updated_at: now
        })
      }

      if (positionsToCreate.length) {
        await queryInterface.bulkInsert('positions', positionsToCreate)
      }

      await queryInterface.sequelize.query(`
        UPDATE employees AS e
        SET position_id = p.id
        FROM positions AS p
        WHERE e.position_id IS NULL
          AND LOWER(BTRIM(p.name)) = LOWER(BTRIM(e.position))
      `)
    }

    const unresolvedEmployees = await queryInterface.sequelize.query(
      'SELECT COUNT(*) AS count FROM employees WHERE position_id IS NULL',
      { type: Sequelize.QueryTypes.SELECT }
    )
    if (Number(unresolvedEmployees[0].count) > 0) {
      throw new Error(
        `Cannot migrate employee positions: ${unresolvedEmployees[0].count} employee(s) have no matching position`
      )
    }

    await queryInterface.sequelize.query(
      'ALTER TABLE "employees" ALTER COLUMN "position_id" SET NOT NULL'
    )

    if (employeeColumns.position) {
      await queryInterface.removeColumn('employees', 'position')
    }
  },

  async down(queryInterface, Sequelize) {
    const employeeColumns = await queryInterface.describeTable('employees')
    if (!employeeColumns.position) {
      await queryInterface.addColumn('employees', 'position', {
        type: Sequelize.STRING,
        allowNull: true
      })
    }

    await queryInterface.sequelize.query(`
      UPDATE employees AS e
      SET position = COALESCE(p.name, 'Unknown')
      FROM positions AS p
      WHERE e.position_id = p.id
    `)
    await queryInterface.sequelize.query(`
      UPDATE employees
      SET position = COALESCE(position, 'Unknown')
      WHERE position IS NULL
    `)
    await queryInterface.sequelize.query(
      'ALTER TABLE "employees" ALTER COLUMN "position" SET NOT NULL'
    )
    await queryInterface.sequelize.query(
      'ALTER TABLE "employees" ALTER COLUMN "position_id" DROP NOT NULL'
    )
  }
}
