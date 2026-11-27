const db = require('../../../db/models')
const { api } = require('../../utils/api')
const { compare } = require('../../utils/argon')
const { HttpStatusCode } = require('axios')
const {
  signAccessToken,
  hashToken,
  setAuthCookies,
  clearAuthCookies,
  createSession,
  rotateSession,
  revokeSessionByToken,
  revokeSessionById
} = require('./session')

const User = db.User

const getUserRoleName = (user) => user?.role?.name || 'EMPLOYEE'
const getUserPermissionKeys = (user) => user?.role?.permissions?.map((permission) => permission.key) || []

const roleWithPermissions = {
  model: db.Role,
  as: 'role',
  attributes: ['id', 'name'],
  include: [{
    model: db.Permission,
    as: 'permissions',
    attributes: ['key']
  }]
}

const toSessionUser = (user) => ({
  id: user.id,
  email: user.email,
  employee_id: user.employee_id || null,
  role: getUserRoleName(user),
  permissions: getUserPermissionKeys(user)
})

class Controller {
  static async login(req, res, next) {
    try {
      const email = req.body?.email
      const password = req.body?.password

      if (!email || !password) {
        throw { code: HttpStatusCode.BadRequest, message: 'Email and password are required' }
      }

      const user = await User.findOne({
        where: { email },
        include: [roleWithPermissions]
      })

      if (!user) {
        throw { code: 400, message: 'User not found' }
      }

      if (user.status === false) {
        throw { code: 400, message: 'User is inactive' }
      }

      const isValid = await compare(password, user.password)

      if (!isValid) {
        throw { code: 400, message: 'Invalid Password' }
      }

      const { session, refreshToken } = await createSession({
        userId: user.id,
        req
      })

      const accessToken = signAccessToken({
        userId: user.id,
        employeeId: user.employee_id,
        role: getUserRoleName(user),
        status: user.status,
        sessionId: session.id
      })

      setAuthCookies(res, { accessToken, refreshToken })

      const result = {
        ...toSessionUser(user),
        token: accessToken
      }

      return res
        .status(HttpStatusCode.Ok)
        .json(api(result, HttpStatusCode.Ok, { req }))
    } catch (err) {
      return next(err)
    }
  }

  static async refresh(req, res, next) {
    try {
      const refreshToken = req.cookies?.refresh_token

      if (!refreshToken) {
        throw { code: HttpStatusCode.Unauthorized, message: 'No refresh token provided' }
      }

      const { user, session, refreshToken: nextRefreshToken } = await rotateSession({
        refreshToken,
        req
      })

      const accessToken = signAccessToken({
        userId: user.id,
        employeeId: user.employee_id,
        role: getUserRoleName(user),
        status: user.status,
        sessionId: session.id
      })

      setAuthCookies(res, { accessToken, refreshToken: nextRefreshToken })

      return res
        .status(HttpStatusCode.Ok)
        .json(api({
          ...toSessionUser(user),
          token: accessToken
        }, HttpStatusCode.Ok, { req }))
    } catch (err) {
      return next(err)
    }
  }

  static async logout(req, res, next) {
    try {
      await revokeSessionByToken({ refreshToken: req.cookies?.refresh_token })
      clearAuthCookies(res)
      return res
        .status(HttpStatusCode.Ok)
        .json(api(null, HttpStatusCode.Ok, { req }))
    } catch (err) {
      return next(err)
    }
  }

  static async getMe(req, res, next) {
    try {
      const user = await User.findByPk(req.user.id, {
        attributes: { exclude: ['password'] },
        include: [roleWithPermissions]
      })

      if (!user) throw new Error('User not found')

      return res
        .status(HttpStatusCode.Ok)
        .json(api({
          id: user.id,
          email: user.email,
          employee_id: user.employee_id || null,
          status: user.status,
          role: getUserRoleName(user),
          permissions: getUserPermissionKeys(user)
        }, HttpStatusCode.Ok, { req }))
    } catch (err) {
      return next(err)
    }
  }

  static async getSessions(req, res, next) {
    try {
      const sessions = await db.UserSession.findAll({
        where: {
          user_id: req.user.id,
          revoked_at: null
        },
        order: [['created_at', 'DESC']]
      })

      const currentHash = req.cookies?.refresh_token
        ? hashToken(req.cookies.refresh_token)
        : null

      const now = Date.now()
      const active = sessions
        .filter((session) => session.expires_at.getTime() > now)
        .map((session) => ({
          id: session.id,
          current: currentHash === session.refresh_token_hash,
          user_agent: session.user_agent,
          ip_address: session.ip_address,
          last_used_at: session.last_used_at,
          expires_at: session.expires_at,
          created_at: session.created_at
        }))

      return res
        .status(HttpStatusCode.Ok)
        .json(api(active, HttpStatusCode.Ok, { req }))
    } catch (err) {
      return next(err)
    }
  }

  static async revokeSession(req, res, next) {
    try {
      await revokeSessionById({
        sessionId: req.params.id,
        userId: req.user.id
      })
      return res
        .status(HttpStatusCode.Ok)
        .json(api({ id: req.params.id }, HttpStatusCode.Ok, { req }))
    } catch (err) {
      return next(err)
    }
  }
}

module.exports = Controller
