const { Op } = require('sequelize')
const db = require('../../db/models')
const { sendMail } = require('../utils/mailer')
const { computeNextAttempt, MAX_ATTEMPTS } = require('../modules/notification/service')
const withLock = require('./withLock')

const POLL_LIMIT = 20

const runOutboxDrain = () =>
  withLock('notification-outbox-drain', async () => {
    const now = new Date()

    const pending = await db.NotificationOutbox.findAll({
      where: {
        status: 'PENDING',
        [Op.or]: [
          { next_attempt_at: null },
          { next_attempt_at: { [Op.lte]: now } }
        ]
      },
      order: [['created_at', 'ASC']],
      limit: POLL_LIMIT
    })

    let sent = 0
    let failed = 0

    for (const delivery of pending) {
      const notification = await db.Notification.findByPk(delivery.notification_id, {
        paranoid: false
      })
      const user = notification?.user_id
        ? await db.User.findByPk(notification.user_id, { attributes: ['id', 'email'] })
        : null

      try {
        if (!user?.email) throw new Error('Recipient email not available')

        await sendMail({
          to: user.email,
          subject: notification.title,
          text: notification.body || notification.title
        })

        await delivery.update({
          status: 'SENT',
          sent_at: new Date(),
          attempts: delivery.attempts + 1,
          last_error: null,
          next_attempt_at: null
        })
        sent += 1
      } catch (err) {
        const attempts = delivery.attempts + 1
        const nextAttemptAt = computeNextAttempt(attempts)

        await delivery.update({
          status: nextAttemptAt ? 'PENDING' : 'FAILED',
          attempts,
          last_error: String(err.message || err).slice(0, 1000),
          next_attempt_at: nextAttemptAt
        })
        failed += 1
      }
    }

    return { picked: pending.length, sent, failed, max_attempts: MAX_ATTEMPTS }
  })

module.exports = runOutboxDrain
