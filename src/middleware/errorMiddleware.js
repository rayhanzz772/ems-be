const { UniqueConstraintError, ForeignKeyConstraintError, ValidationError } = require('sequelize')
const { api } = require('../utils/api')

const errorMiddleware = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err)
  }

  let statusCode = Number(err?.statusCode ?? err?.status ?? err?.code)

  if (err instanceof UniqueConstraintError || err instanceof ForeignKeyConstraintError) {
    statusCode = 409
  } else if (err instanceof ValidationError) {
    statusCode = 400
  } else if (!Number.isInteger(statusCode) || statusCode < 400 || statusCode > 599) {
    statusCode = 500
  }

  const response = api(null, statusCode, { err })

  if (statusCode >= 500 && process.env.NODE_ENV === 'production') {
    response.message = 'Internal server error'
  } else if (!response.message || response.message === 'success') {
    response.message = 'An unexpected error occurred'
  }

  if (statusCode >= 500) {
    console.error(err)
  }

  return res.status(statusCode).json(response)
}

module.exports = errorMiddleware