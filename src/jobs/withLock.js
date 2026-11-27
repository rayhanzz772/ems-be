const { Op } = require('sequelize')
const cuid = require('cuid')
const db = require('../../db/models')

const STALE_AFTER_MS = 60 * 60 * 1000

/**
 * Menjalankan `fn` hanya bila tidak ada run dengan nama yang sama berstatus
 * RUNNING. Lock-nya baris di `job_runs` dengan partial unique index, bukan
 * advisory lock — advisory lock terikat koneksi pool dan dilepas saat koneksi
 * kembali, sehingga tidak menjamin apa pun di sini.
 */
const withLock = async (name, fn) => {
  const now = new Date()

  // Run yang tertinggal karena proses mati tidak boleh mengunci selamanya.
  await db.JobRun.update(
    {
      status: 'FAILED',
      finished_at: now,
      error: 'Stale RUNNING run (process likely crashed)'
    },
    {
      where: {
        name,
        status: 'RUNNING',
        started_at: { [Op.lt]: new Date(now.getTime() - STALE_AFTER_MS) }
      }
    }
  )

  let run
  try {
    run = await db.JobRun.create({
      id: cuid(),
      name,
      status: 'RUNNING',
      started_at: now
    })
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return { skipped: true, reason: 'already running' }
    }
    throw err
  }

  try {
    const detail = await fn()
    await run.update({
      status: 'SUCCESS',
      finished_at: new Date(),
      detail: detail ?? null
    })
    return { skipped: false, detail: detail ?? null }
  } catch (err) {
    await run.update({
      status: 'FAILED',
      finished_at: new Date(),
      error: String(err.message || err)
    })
    throw err
  }
}

module.exports = withLock
