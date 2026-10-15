const pino = require('pino')
const pinoHttp = require('pino-http')
const crypto = require('node:crypto')

const isProduction = process.env.NODE_ENV === 'production'

const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  transport: !isProduction
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
          ignore: 'pid,hostname'
        }
      }
    : undefined
})

const httpLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const existingId = req.headers['x-request-id']
    if (existingId) return existingId
    const id = crypto.randomUUID()
    res.setHeader('x-request-id', id)
    return id
  },
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 500 || err) return 'error'
    if (res.statusCode >= 400) return 'warn'
    return 'info'
  },
  customSuccessMessage: (req, res) => {
    return `${req.method} ${req.url} -> ${res.statusCode}`
  },
  customErrorMessage: (req, res, err) => {
    return `${req.method} ${req.url} failed with ${res.statusCode}: ${err.message}`
  },
  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      remoteAddress: req.remoteAddress
    }),
    res: (res) => ({
      statusCode: res.statusCode
    })
  }
})

module.exports = {
  logger,
  httpLogger
}
