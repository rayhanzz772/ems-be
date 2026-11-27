const cuid = require('cuid')
const db = require('../../../db/models')

const MAX_ATTEMPTS = 5

/**
 * Backoff eksponensial dalam menit. Setelah MAX_ATTEMPTS, pengiriman berhenti
 * dan baris menjadi FAILED permanen — lebih jujur daripada mencoba selamanya.
 */
const computeNextAttempt = (attempts, now = new Date()) => {
  if (attempts >= MAX_ATTEMPTS) return null
  return new Date(now.getTime() + (2 ** attempts) * 60 * 1000)
}

/**
 * Transactional outbox: baris notifikasi dan baris pengiriman ditulis dalam
 * satu transaksi. Pemanggil bisa mengirim `transaction` agar notifikasi ikut
 * batal bila aksi bisnisnya gagal.
 */
const notify = async ({
  userId = null,
  employeeId = null,
  type,
  title,
  body = null,
  entityType = null,
  entityId = null,
  data = null,
  channels = ['IN_APP'],
  transaction = null
}) => {
  const notification = await db.Notification.create(
    {
      id: cuid(),
      user_id: userId,
      employee_id: employeeId,
      type,
      title,
      body,
      entity_type: entityType,
      entity_id: entityId,
      data
    },
    transaction ? { transaction } : undefined
  )

  if (channels.includes('EMAIL') && userId) {
    await db.NotificationOutbox.create(
      {
        id: cuid(),
        notification_id: notification.id,
        channel: 'EMAIL',
        status: 'PENDING',
        next_attempt_at: new Date()
      },
      transaction ? { transaction } : undefined
    )
  }

  return notification
}

module.exports = {
  MAX_ATTEMPTS,
  computeNextAttempt,
  notify
}
