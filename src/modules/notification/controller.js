const { HttpStatusCode } = require('axios')
const db = require('../../../db/models')
const { api, sequelizePaginate } = require('../../utils/api')

const parsePagination = (query) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1)
  const perPage = Math.min(100, Math.max(1, parseInt(query.per_page, 10) || 10))
  return { page, perPage }
}

class Controller {
  static async getNotifications(req, res, next) {
    try {
      const { page, perPage } = parsePagination(req.query)
      const where = { user_id: req.user.id }

      if (req.query.unread === 'true') {
        where.read_at = null
      }

      const result = await db.Notification.findAndCountAll({
        where,
        order: [['created_at', 'DESC']],
        ...sequelizePaginate(page, perPage)
      })

      return res
        .status(HttpStatusCode.Ok)
        .json(api({ data: result.rows, page, per_page: perPage, count: result.count }, HttpStatusCode.Ok, { req }))
    } catch (err) {
      return next(err)
    }
  }

  static async markRead(req, res, next) {
    try {
      const notification = await db.Notification.findOne({
        where: { id: req.params.id, user_id: req.user.id }
      })

      if (!notification) {
        throw { code: HttpStatusCode.NotFound, message: 'Notification not found' }
      }

      if (!notification.read_at) {
        await notification.update({ read_at: new Date() })
      }

      return res
        .status(HttpStatusCode.Ok)
        .json(api({ id: notification.id, read_at: notification.read_at }, HttpStatusCode.Ok, { req }))
    } catch (err) {
      return next(err)
    }
  }

  static async markAllRead(req, res, next) {
    try {
      const [updated] = await db.Notification.update(
        { read_at: new Date() },
        { where: { user_id: req.user.id, read_at: null } }
      )

      return res
        .status(HttpStatusCode.Ok)
        .json(api({ updated }, HttpStatusCode.Ok, { req }))
    } catch (err) {
      return next(err)
    }
  }
}

module.exports = Controller
