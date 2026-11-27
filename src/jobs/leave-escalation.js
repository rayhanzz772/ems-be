'use strict'

const { Op } = require('sequelize')
const db = require('../../db/models')
const withLock = require('./withLock')
const { LEVELS, notifyCurrentApprover } = require('../modules/leaves/service')

const DEFAULT_ESCALATION_DAYS = 3
const MS_PER_DAY = 24 * 60 * 60 * 1000

const escalationDays = () => {
  const value = Number(process.env.LEAVE_ESCALATION_DAYS)
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_ESCALATION_DAYS
}

/**
 * Permohonan yang menggantung di atasan langsung naik ke HR setelah N hari.
 * Satu baris satu transaksi supaya notifikasi tidak pernah tertinggal dari
 * perubahan tingkat.
 */
const runLeaveEscalation = () => withLock('leave-escalation', async () => {
  const days = escalationDays()
  const cutoff = new Date(Date.now() - days * MS_PER_DAY)

  const stale = await db.LeaveRequest.findAll({
    where: {
      status: 'PENDING',
      current_level: LEVELS.LEVEL_1,
      level_1_decided_at: null,
      created_at: { [Op.lt]: cutoff }
    },
    order: [['created_at', 'ASC']],
    limit: 100
  })

  let escalated = 0
  for (const leaveRequest of stale) {
    const didEscalate = await db.sequelize.transaction(async (transaction) => {
      const locked = await db.LeaveRequest.findByPk(leaveRequest.id, {
        transaction,
        lock: transaction.LOCK.UPDATE
      })

      // Bisa saja sudah diputuskan antara query awal dan lock ini.
      if (
        !locked ||
        locked.status !== 'PENDING' ||
        locked.current_level !== LEVELS.LEVEL_1 ||
        locked.level_1_decided_at
      ) {
        return false
      }

      await locked.update({
        current_level: LEVELS.LEVEL_2,
        escalated_at: new Date()
      }, { transaction })

      await notifyCurrentApprover({
        leaveRequest: locked,
        title: 'Leave request escalated to HR',
        body: `A leave request was not decided by the direct manager within ${days} day(s) and has been escalated.`,
        transaction
      })

      return true
    })

    if (didEscalate) escalated += 1
  }

  return { escalated, escalation_days: days }
})

module.exports = runLeaveEscalation
