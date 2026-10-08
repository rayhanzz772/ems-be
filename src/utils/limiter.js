const { rateLimit } = require('express-rate-limit')

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 2
})

module.exports = limiter