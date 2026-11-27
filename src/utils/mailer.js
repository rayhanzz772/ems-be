const nodemailer = require('nodemailer')
const { logger } = require('./logger')

let transporter = null

const isConfigured = () => Boolean(process.env.SMTP_HOST && process.env.MAIL_FROM)

const getTransporter = () => {
  if (!isConfigured()) return null
  if (transporter) return transporter

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined
  })

  return transporter
}

/**
 * Melempar bila SMTP belum dikonfigurasi. Pemanggil (outbox drain) menyimpan
 * error itu supaya pengiriman dicoba lagi tanpa kehilangan notifikasi.
 */
const sendMail = async ({ to, subject, text }) => {
  const client = getTransporter()
  if (!client) {
    throw new Error('SMTP is not configured (SMTP_HOST / MAIL_FROM)')
  }

  const info = await client.sendMail({
    from: process.env.MAIL_FROM,
    to,
    subject,
    text
  })

  logger.info({ messageId: info.messageId, to }, 'Email sent')
  return info
}

module.exports = {
  isConfigured,
  sendMail
}
