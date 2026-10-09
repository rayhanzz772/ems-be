const jwt = require('jsonwebtoken')
const db = require('../../../db/models')
const { api } = require('../../utils/api')
const { compare } = require('../../utils/argon')
const { HttpStatusCode } = require('axios')

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

class Controller {
  static async login(req, res, next) {
    try {
      const email = req.body?.email
      const password = req.body?.password

      if (!email || !password) {
        throw { code: HttpStatusCode.BadRequest, message: 'Email and password are required' }
      }

      const user = await User.findOne({
        where: {
          email: email
        },
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

      const roleName = getUserRoleName(user)
      const payload = {
        userId: user.id,
        role: roleName,
        status: user.status
      }

      const token = jwt.sign(payload, process.env.JWT_KEY, {
        expiresIn: '7d'
      })

      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000
      })

      const userSafe = {
        id: user.id,
        token: token,
        email: user.email,
        role: roleName,
        permissions: getUserPermissionKeys(user)
      }

      return res
        .status(HttpStatusCode.Ok)
        .json(api(userSafe, HttpStatusCode.Ok, { req }))
    } catch (err) {
      return next(err)
    }
  }

  static async logout(req, res, next) {
    try {
      res.clearCookie('token')
      return res
        .status(HttpStatusCode.Ok)
        .json(api(null, HttpStatusCode.Ok, { req }))
    } catch (err) {
      return next(err)
    }
  }

  static async getMe(req, res, next) {
    try {
      const userId = req.user.id

      const user = await User.findByPk(userId, {
        attributes: { exclude: ['password'] },
        include: [roleWithPermissions]
      })

      if (!user) throw new Error('User not found')

      const result = {
        id: user.id,
        email: user.email,
        status: user.status,
        role: getUserRoleName(user),
        permissions: getUserPermissionKeys(user)
      }

      return res
        .status(HttpStatusCode.Ok)
        .json(api(result, HttpStatusCode.Ok, { req }))
    } catch (err) {
      return next(err)
    }
  }
}

module.exports = Controller
