const { Op } = require('sequelize')
const db = require('../../db/models')
const withLock = require('./withLock')

const RETENTION_DAYS = 30

const runSessionCleanup = () =>
  withLock('session-cleanup', async () => {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000)

    const deleted = await db.UserSession.destroy({
      where: {
        [Op.or]: [
          { expires_at: { [Op.lt]: cutoff } },
          { revoked_at: { [Op.lt]: cutoff } }
        ]
      }
    })

    return { deleted, retention_days: RETENTION_DAYS }
  })

module.exports = runSessionCleanup
