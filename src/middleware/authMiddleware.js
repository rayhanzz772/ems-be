const jwt = require('jsonwebtoken')

const authMiddleware = (req, res, next) => {
  const token = req.cookies?.token || req.headers.authorization?.split(' ')[1]

  if (!token) {
    return next({ statusCode: 401, message: 'No token provided' })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_KEY)

    req.user = {
      id: decoded.userId,
      role: decoded.role,
      type: decoded.type,
      status: decoded.status
    }

    if (req.user.status === false) {
      return next({ statusCode: 403, message: 'User is inactive or suspended' })
    }

    next()
  } catch (err) {
    return next({ statusCode: 401, message: 'Invalid or expired token' })
  }
}

module.exports = authMiddleware
