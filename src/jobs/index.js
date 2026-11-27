const cron = require('node-cron')
const { logger } = require('../utils/logger')
const runSessionCleanup = require('./session-cleanup')
const runOutboxDrain = require('./outbox-drain')
const runLeaveEscalation = require('./leave-escalation')

const TIMEZONE = 'Asia/Jakarta'

// shortcut: node-cron mengasumsikan satu instance. Kalau Railway menambah
// replika, pindah ke BullMQ + Redis supaya job tidak jalan duplikat.
let started = false

const safely = (name, job) => async () => {
  try {
    const result = await job()
    if (result?.skipped) {
      logger.info({ job: name, ...result }, 'Job skipped')
    } else {
      logger.info({ job: name, ...result }, 'Job finished')
    }
  } catch (err) {
    logger.error({ job: name, err }, 'Job failed')
  }
}

const startJobs = () => {
  if (started || process.env.DISABLE_JOBS === 'true') return
  started = true

  cron.schedule('* * * * *', safely('notification-outbox-drain', runOutboxDrain), { timezone: TIMEZONE })
  cron.schedule('0 2 * * *', safely('leave-escalation', runLeaveEscalation), { timezone: TIMEZONE })
  cron.schedule('0 3 * * *', safely('session-cleanup', runSessionCleanup), { timezone: TIMEZONE })

  logger.info({ timezone: TIMEZONE }, 'Scheduler started')
}

module.exports = { startJobs }
