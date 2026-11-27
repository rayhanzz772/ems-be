require('dotenv').config({})

const express = require('express')
const app = express()
const { httpLogger, logger } = require('./src/utils/logger')
const cors = require('cors')
const route = require('./src/routes')
const { createServer } = require('node:http')
const cookieParser = require('cookie-parser')
const helmet = require('helmet')
const errorMiddleware = require('./src/middleware/errorMiddleware')
const db = require('./db/models')
const { api } = require('./src/utils/api')
const openApiSpec = require('./src/docs/openapi')
const { startJobs } = require('./src/jobs')
const { isConfigured: isMailConfigured } = require('./src/utils/mailer')

const mode = process.env.NODE_ENV || 'development'
const allowedOriginsRaw = process.env.ALLOWED_ORIGINS || ''
const allowAll = allowedOriginsRaw === '*'

const allowedOrigins = allowAll
  ? []
  : allowedOriginsRaw
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)

app.use(
  helmet({
    hidePoweredBy: true
  })
)
app.disable('x-powered-by')

const corsOptions = (req, callback) => {
  const origin = req.headers.origin
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https'

  const isAllowed = () => {
    if (allowAll) return true
    if (!origin) return false
    return allowedOrigins.includes(origin)
  }

  if (mode === 'production') {
    if (isAllowed()) {
      return callback(null, {
        origin: true,
        credentials: true,
        exposedHeaders: ['Content-Disposition']
      })
    }
    return callback(null, false)
  }

  if (isSecure) {
    if (isAllowed()) {
      return callback(null, {
        origin: true,
        credentials: true,
        exposedHeaders: ['Content-Disposition']
      })
    }
    return callback(null, false)
  }

  return callback(null, {
    origin: true,
    credentials: true,
    exposedHeaders: ['Content-Disposition']
  })
}

app.use(httpLogger)
app.use(cors(corsOptions))
app.use(cookieParser())

app.use(
  express.json({
    limit: '50mb',
    verify: (req, res, buf) => {
      req.rawBody = buf.toString()
    }
  })
)

app.use(
  express.urlencoded({
    extended: true,
    limit: '50mb',
    verify: (req, res, buf) => {
      req.rawBody = buf.toString()
    }
  })
)

const latestJobRuns = async () => {
  try {
    const runs = await db.JobRun.findAll({
      attributes: ['name', 'status', 'started_at', 'finished_at', 'error'],
      order: [['started_at', 'DESC']],
      limit: 50
    })

    const latest = new Map()
    for (const run of runs) {
      if (!latest.has(run.name)) latest.set(run.name, run)
    }

    return Object.fromEntries(
      [...latest.entries()].map(([name, run]) => [name, {
        status: run.status,
        started_at: run.started_at,
        finished_at: run.finished_at,
        error: run.error
      }])
    )
  } catch (err) {
    return null
  }
}

const pendingOutboxCount = async () => {
  try {
    return await db.NotificationOutbox.count({ where: { status: 'PENDING' } })
  } catch (err) {
    return null
  }
}

app.get('/health', async (req, res, next) => {
  try {
    await db.sequelize.authenticate()

    const [jobs, outboxPending] = await Promise.all([
      latestJobRuns(),
      pendingOutboxCount()
    ])

    return res.status(200).json(
      api({
        status: 'ok',
        database: 'connected',
        mail_configured: isMailConfigured(),
        outbox_pending: outboxPending,
        jobs,
        timestamp: new Date().toISOString()
      }, 200)
    )
  } catch (err) {
    return next({ statusCode: 503, message: 'Service unavailable' })
  }
})

app.get('/api-docs/openapi.json', (req, res) => {
  return res.json(openApiSpec)
})

app.use('/api/v1', route)

app.use((req, res, next) => {
  next({ statusCode: 404, message: 'Route not found' })
})

app.use(errorMiddleware)

const port = process.env.PORT || 8000
const server = createServer(app)

server.listen(port, () => {
  logger.info(`Server running on port ${port}`)
  startJobs()
})

module.exports = app
