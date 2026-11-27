'use strict'

/**
 * Menautkan users.employee_id berdasarkan email yang sama.
 *
 * Aman dijalankan berulang: hanya mengisi user yang employee_id-nya masih null.
 * Default adalah dry-run. Tambahkan --apply untuk menulis.
 *
 *   node src/scripts/link-users-employees.js
 *   node src/scripts/link-users-employees.js --apply
 */

const db = require('../../db/models')

const apply = process.argv.includes('--apply')

const normalize = (value) => String(value || '').trim().toLowerCase()

const main = async () => {
  const employees = await db.Employee.findAll({
    attributes: ['id', 'email', 'status'],
    where: { status: true }
  })

  const byEmail = new Map()
  for (const employee of employees) {
    const key = normalize(employee.email)
    if (!key) continue
    if (!byEmail.has(key)) byEmail.set(key, [])
    byEmail.get(key).push(employee.id)
  }

  const users = await db.User.findAll({
    attributes: ['id', 'email', 'employee_id']
  })

  const linked = []
  const ambiguous = []
  const missing = []

  for (const user of users) {
    if (user.employee_id) continue

    const candidates = byEmail.get(normalize(user.email)) || []
    if (candidates.length === 1) {
      linked.push({ userId: user.id, employeeId: candidates[0] })
    } else if (candidates.length > 1) {
      ambiguous.push({ userId: user.id, email: user.email, candidates: candidates.length })
    } else {
      missing.push({ userId: user.id, email: user.email })
    }
  }

  if (apply) {
    await db.sequelize.transaction(async (transaction) => {
      for (const row of linked) {
        await db.User.update(
          { employee_id: row.employeeId },
          { where: { id: row.userId, employee_id: null }, transaction }
        )
      }
    })
  }

  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    linked: linked.length,
    ambiguous,
    missing
  }, null, 2))

  if (!apply && linked.length > 0) {
    console.log('\nJalankan ulang dengan --apply untuk menyimpan hasil di atas.')
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
