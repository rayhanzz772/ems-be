'use strict'

const cuid = require('cuid')

/**
 * Mengalokasikan saldo cuti tahunan.
 *
 * Kenapa perlu: `applyBalanceOnFinalApproval` (src/modules/leaves/service.js:124)
 * melempar 409 "No leave balance exists" saat permohonan dengan
 * `requires_balance: true` disetujui di LEVEL_2, bila baris saldo belum ada.
 *
 * Ruang lingkup: **semua karyawan aktif**, bukan hanya user ber-role EMPLOYEE.
 * User HR dan ADMIN juga karyawan dan bisa mengajukan cuti; memfilter ke role
 * EMPLOYEE akan menyisakan 409 yang sama untuk mereka. Filter role juga menuntut
 * join ke users + roles + role_permissions, jadi versi ini lebih kecil.
 *
 * Tahun: tahun berjalan dan tahun berikutnya. Permohonan untuk Januari tahun
 * depan diajukan di bulan November-Desember, jadi hanya tahun berjalan akan
 * memicu 409 yang sama.
 * shortcut: belum ada reset saldo otomatis tiap tahun; upgrade dengan job
 * cron tahunan sesuai roadmap (saldo cuti tanpa reset tahunan).
 *
 * Idempoten: baris saldo yang sudah ada tidak pernah diubah, supaya
 * `used_days` dan `adjustment_days` hasil kerja nyata tidak tertimpa.
 */
module.exports = {
  async up (queryInterface, Sequelize) {
    const now = new Date()
    const currentYear = now.getFullYear()
    const years = [currentYear, currentYear + 1]

    const balanceTypes = await queryInterface.sequelize.query(
      `
      SELECT id, name, annual_quota
      FROM leave_types
      WHERE requires_balance = true
        AND is_active = true
        AND annual_quota IS NOT NULL
      `,
      { type: Sequelize.QueryTypes.SELECT }
    )

    if (!balanceTypes.length) {
      console.log('Leave balances: tidak ada tipe cuti balance berkuota, dilewati.')
      return
    }

    const employees = await queryInterface.sequelize.query(
      `
      SELECT id
      FROM employees
      WHERE deleted_at IS NULL AND status = true
      `,
      { type: Sequelize.QueryTypes.SELECT }
    )

    const existing = await queryInterface.sequelize.query(
      `
      SELECT employee_id, leave_type_id, year
      FROM leave_balances
      `,
      { type: Sequelize.QueryTypes.SELECT }
    )
    const existingKeys = new Set(
      existing.map((row) => `${row.employee_id}:${row.leave_type_id}:${row.year}`)
    )

    // Saldo baru harus mencerminkan pemotongan yang sudah terjadi, kalau tidak
    // karyawan bisa memakai kembali hari yang sudah disetujui sebelumnya.
    const used = await queryInterface.sequelize.query(
      `
      SELECT employee_id, leave_type_id, EXTRACT(YEAR FROM start_date)::int AS year,
             SUM(duration_days)::float AS used_days
      FROM leave_requests
      WHERE status = 'APPROVED'
      GROUP BY employee_id, leave_type_id, EXTRACT(YEAR FROM start_date)
      `,
      { type: Sequelize.QueryTypes.SELECT }
    )
    const usedByKey = new Map(
      used.map((row) => [
        `${row.employee_id}:${row.leave_type_id}:${row.year}`,
        Number(row.used_days)
      ])
    )

    const rows = []
    for (const employee of employees) {
      for (const leaveType of balanceTypes) {
        for (const year of years) {
          const key = `${employee.id}:${leaveType.id}:${year}`
          if (existingKeys.has(key)) continue
          rows.push({
            id: cuid(),
            employee_id: employee.id,
            leave_type_id: leaveType.id,
            year,
            allocated_days: Number(leaveType.annual_quota),
            adjustment_days: 0,
            used_days: usedByKey.get(key) ?? 0,
            created_at: now,
            updated_at: now
          })
        }
      }
    }

    if (rows.length) {
      await queryInterface.bulkInsert('leave_balances', rows)
    }

    console.log(
      `Leave balances: ${rows.length} baris dibuat untuk ${employees.length} karyawan ` +
      `x ${balanceTypes.length} tipe x tahun ${years.join(', ')}. ` +
      `${existing.length} baris sudah ada dan tidak diubah.`
    )
  },

  async down (queryInterface, Sequelize) {
    // Hanya hapus saldo yang benar-benar belum terpakai dan tidak dirujuk
    // permohonan, supaya tidak merusak riwayat.
    await queryInterface.sequelize.query(
      `
      DELETE FROM leave_balances lb
      WHERE lb.used_days = 0
        AND lb.adjustment_days = 0
        AND NOT EXISTS (
          SELECT 1 FROM leave_requests lr
          WHERE lr.employee_id = lb.employee_id
            AND lr.leave_type_id = lb.leave_type_id
            AND EXTRACT(YEAR FROM lr.start_date) = lb.year
        )
      `
    )
  }
}
