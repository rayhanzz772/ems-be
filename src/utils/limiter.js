const { rateLimit } = require('express-rate-limit')

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 2000,
    handler: (req, res, next, options) => {
        next({ statusCode: options.statusCode, message: 'Too many requests' })
    }
})

module.exports = limiter