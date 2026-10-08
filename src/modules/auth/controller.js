const jwt = require('jsonwebtoken')
const db = require('../../../db/models')
const { api } = require('../../utils/api')
const { compare } = require('../../utils/argon')
const { HttpStatusCode } = require('axios')

const User = db.User

class Controller {
  static async login(req, res) {
    try {
      const { email, password } = req.body

      const user = await User.findOne({
        where: {
          email: email
        }
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

      const payload = {
        userId: user.id
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
        email: user.email,
        role: user.role
      }

      return res
        .status(HttpStatusCode.Ok)
        .json(api(userSafe, HttpStatusCode.Ok, { req }))
    } catch (err) {
      const code = err?.code ?? HttpStatusCode.InternalServerError
      return res.status(code).json(api(null, code, { err }))
    }
  }

  static async logout(req, res) {
    try {
      res.clearCookie('token')
      return res
        .status(HttpStatusCode.Ok)
        .json(api(null, HttpStatusCode.Ok, { req }))
    } catch (err) {
      const code = err?.code ?? HttpStatusCode.InternalServerError
      return res.status(code).json(api(null, code, { err }))
    }
  }

  static async getMe(req, res) {
    try {
      const userId = req.user.id

      const user = await User.findByPk(userId, {
        attributes: { exclude: ['password'] },
      })

      if (!user) throw new Error('User not found')

      const result = {
        id: user.id,
        email: user.email,
        status: user.status,
        role: user.role
      }

      return res
        .status(HttpStatusCode.Ok)
        .json(api(result, HttpStatusCode.Ok, { req }))
    } catch (err) {
      const code = err?.code ?? HttpStatusCode.InternalServerError
      return res.status(code).json(api(null, code, { err }))
    }
  }
}

module.exports = Controller
