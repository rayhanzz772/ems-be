const { HttpStatusCode } = require('axios')
const { api } = require('../../../src/utils/api')
const db = require('../../../db/models')

class Controller {
  static async getPermissions(req, res, next) {
    try {
      const permissions = await db.Permission.findAll({
        attributes: ['id', 'key', 'resource', 'action', 'description'],
        order: [['resource', 'ASC'], ['action', 'ASC']]
      })

      return res.status(HttpStatusCode.Ok).json(api(permissions, HttpStatusCode.Ok, { req }))
    } catch (err) {
      return next(err)
    }
  }
}

module.exports = Controller
