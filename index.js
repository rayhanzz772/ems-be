require('dotenv').config({})

const express = require('express')
const app = express()
const morgan = require('morgan')
const cors = require('cors')
const route = require('./src/routes')
const { createServer } = require('node:http')
const cookieParser = require('cookie-parser')
const helmet = require('helmet')
const errorMiddleware = require('./src/middleware/errorMiddleware')
const db = require('./db/models')
const { api } = require('./src/utils/api')

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
      return callback(null, { origin: true, credentials: true })
    }
    return callback(null, false)
  }

  if (isSecure) {
    if (isAllowed()) {
      return callback(null, { origin: true, credentials: true })
    }
    return callback(null, false)
  }

  return callback(null, { origin: true, credentials: true })
}

app.use(morgan('dev'))
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

app.get('/health', async (req, res, next) => {
  try {
    await db.sequelize.authenticate()

    return res.status(200).json(
      api({
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString()
      }, 200)
    )
  } catch (err) {
    return next({ statusCode: 503, message: 'Service unavailable' })
  }
})

app.use('/api/v1', route)

app.use((req, res, next) => {
  next({ statusCode: 404, message: 'Route not found' })
})

app.use(errorMiddleware)

const port = process.env.PORT || 8000
const server = createServer(app)

server.listen(port, () => {
  console.log(`Server Running ⚡ PORT : ${port}`)
})

module.exports = app
