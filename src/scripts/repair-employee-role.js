'use strict'

/**
 * Menyetel permission role EMPLOYEE ke set self-service yang benar.
 *
 * Latar belakang: layar Roles -> Manage permissions memakai PUT /roles/:id/permissions
 * yang bersifat full replace, sehingga set EMPLOYEE pernah tertimpa menjadi hanya
 * 13 key cuti. Selain itu seeder baseline memberi `employee.read`, yang membuka
 * telepon, alamat, tanggal kontrak, dan status resign seluruh karyawan.
 * `leave_request.decide` yang ikut tertimpa bahkan memperbolehkan karyawan biasa
 * menyetujui permohonan LEVEL_2 siapa pun.
 *
 * Aman dijalankan berulang. Default dry-run, tambahkan --apply untuk menulis.
 *
 *   node src/scripts/repair-employee-role.js
 *   node src/scripts/repair-employee-role.js --apply
 */

const db = require('../../db/models')
const cuid = require('cuid')

const ROLE_NAME = 'EMPLOYEE'

const DESIRED_KEYS = [
  'dashboard.read',
  'leave_request.read',
  'leave_request.create',
  'leave_request.update',
  'leave_type.read',
  'leave_balance.read'
]

/**
 * Selisih dua set permission. Murni supaya bisa diuji tanpa DB.
 * @param {string[]} currentKeys key yang sekarang terpasang
 * @param {string[]} desiredKeys key yang seharusnya terpasang
 */
const diffPermissionSets = (currentKeys, desiredKeys) => ({
  toAdd: desiredKeys.filter((key) => !currentKeys.includes(key)),
  toRemove: currentKeys.filter((key) => !desiredKeys.includes(key))
})

const main = async () => {
  const apply = process.argv.includes('--apply')

  const role = await db.Role.findOne({
    where: { name: ROLE_NAME },
    attributes: ['id', 'name', 'status']
  })
  if (!role) {
    console.error(`Role ${ROLE_NAME} tidak ditemukan. Jalankan npm run seed dulu.`)
    process.exit(1)
  }

  const currentRows = await db.sequelize.query(
    `
    SELECT p.id, p.key
    FROM role_permissions rp
    JOIN permissions p ON p.id = rp.permission_id
    WHERE rp.role_id = :roleId
    `,
    {
      replacements: { roleId: role.id },
      type: db.Sequelize.QueryTypes.SELECT
    }
  )
  const currentKeys = currentRows.map((row) => row.key)

  const catalogRows = await db.Permission.findAll({
    attributes: ['id', 'key'],
    where: { key: DESIRED_KEYS }
  })
  const catalog = new Map(catalogRows.map((row) => [row.key, row.id]))
  const unavailable = DESIRED_KEYS.filter((key) => !catalog.has(key))

  const { toAdd, toRemove } = diffPermissionSets(currentKeys, DESIRED_KEYS)
  const addable = toAdd.filter((key) => catalog.has(key))
  const removableIds = currentRows
    .filter((row) => toRemove.includes(row.key))
    .map((row) => row.id)

  if (apply) {
    await db.sequelize.transaction(async (transaction) => {
      if (removableIds.length) {
        await db.RolePermission.destroy(
          { where: { role_id: role.id, permission_id: removableIds }, transaction }
        )
      }
      if (addable.length) {
        const now = new Date()
        await db.RolePermission.bulkCreate(
          addable.map((key) => ({
            id: cuid(),
            role_id: role.id,
            permission_id: catalog.get(key),
            created_at: now,
            updated_at: now
          })),
          { transaction }
        )
      }
    })
  }

  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    role: role.name,
    roleStatus: role.status,
    before: currentKeys.slice().sort(),
    after: currentKeys
      .filter((key) => !toRemove.includes(key))
      .concat(addable)
      .sort(),
    removed: toRemove.sort(),
    added: addable.sort(),
    skippedAdd: toAdd.filter((key) => !catalog.has(key)),
    unavailableInCatalog: unavailable
  }, null, 2))

  if (role.status === false) {
    console.log('\nPERINGATAN: role ini tidak aktif. User dengan role ini akan gagal login.')
  }
  if (unavailable.length) {
    console.log(`\nPERINGATAN: key berikut belum ada di tabel permissions: ${unavailable.join(', ')}. Jalankan npm run seed.`)
  }
  if (!apply && (toRemove.length || toAdd.length)) {
    console.log('\nJalankan ulang dengan --apply untuk menyimpan perubahan di atas.')
  }
}

module.exports = { diffPermissionSets, DESIRED_KEYS }

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
