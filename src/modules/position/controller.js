const cuid = require('cuid')
const { api } = require('../../../src/utils/api')
const db = require('../../../db/models')
const { HttpStatusCode } = require('axios')
const { validateRequest } = require('../../utils/validation')
const { createAuditLog } = require('../../utils/auditLog')
const { createPositionSchema, updatePositionSchema } = require('./schema')

const Position = db.Position

class Controller {
  static async getPositions(req, res, next) {
    try {
      const parsePositiveInteger = (value, fallback, maximum = Number.MAX_SAFE_INTEGER) => {
        const parsed = Number(value)
        return Number.isInteger(parsed) && parsed > 0
          ? Math.min(parsed, maximum)
          : fallback
      }

      const limit = parsePositiveInteger(req.query.per_page, 10, 100)
      const page = parsePositiveInteger(req.query.page, 1)
      const offset = (page - 1) * limit
      const conditions = []
      const replacements = { limit, offset }

      if (req.query.q !== undefined) {
        if (typeof req.query.q !== 'string') {
          throw { code: HttpStatusCode.BadRequest, message: 'Invalid q query parameter' }
        }

        const search = req.query.q.trim()
        if (search) {
          conditions.push('(LOWER(p.name) LIKE LOWER(:search) OR LOWER(p.description) LIKE LOWER(:search))')
          replacements.search = `%${search}%`
        }
      }

      const sortColumns = {
        name: 'p.name',
        created_at: 'p.created_at',
        updated_at: 'p.updated_at'
      }
      const sortColumn = Object.prototype.hasOwnProperty.call(sortColumns, req.query.sort_by)
        ? sortColumns[req.query.sort_by]
        : 'p.created_at'
      const sortOrder = String(req.query.sort_order).toUpperCase() === 'ASC' ? 'ASC' : 'DESC'
      const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

      const rows = await db.sequelize.query(
        `
        SELECT p.id, p.name, p.description, p.created_at, p.updated_at
        FROM positions p
        ${whereClause}
        ORDER BY ${sortColumn} ${sortOrder}
        LIMIT :limit OFFSET :offset
        `,
        { type: db.Sequelize.QueryTypes.SELECT, replacements }
      )
      const countRows = await db.sequelize.query(
        `SELECT COUNT(*) AS total FROM positions p ${whereClause}`,
        { type: db.Sequelize.QueryTypes.SELECT, replacements }
      )

      return res.status(HttpStatusCode.Ok).json(
        api({ count: Number(countRows[0].total), rows }, HttpStatusCode.Ok, { req })
      )
    } catch (err) {
      return next(err)
    }
  }

  static async getPositionById(req, res, next) {
    try {
      const position = await Position.findByPk(req.params.id)

      if (!position) {
        throw { code: HttpStatusCode.NotFound, message: 'Position not found' }
      }

      return res.status(HttpStatusCode.Ok).json(api(position, HttpStatusCode.Ok))
    } catch (err) {
      return next(err)
    }
  }

  static async createPosition(req, res, next) {
    try {
      const payload = validateRequest(createPositionSchema, { body: req.body })
      const position = await Position.create({ id: cuid(), ...payload })

      await createAuditLog({
        userId: req.user.id,
        action: 'CREATE',
        entity: 'Position',
        entityId: position.id,
        newData: position.toJSON()
      })

      return res.status(HttpStatusCode.Created).json(api(position, HttpStatusCode.Created))
    } catch (err) {
      return next(err)
    }
  }

  static async updatePosition(req, res, next) {
    try {
      const position = await Position.findByPk(req.params.id)

      if (!position) {
        throw { code: HttpStatusCode.NotFound, message: 'Position not found' }
      }

      const payload = validateRequest(updatePositionSchema, { body: req.body })
      const oldData = position.toJSON()
      await position.update(payload)

      await createAuditLog({
        userId: req.user.id,
        action: 'UPDATE',
        entity: 'Position',
        entityId: position.id,
        oldData,
        newData: position.toJSON()
      })

      return res.status(HttpStatusCode.Ok).json(api(position, HttpStatusCode.Ok))
    } catch (err) {
      return next(err)
    }
  }

  static async deletePosition(req, res, next) {
    try {
      const position = await Position.findByPk(req.params.id)

      if (!position) {
        throw { code: HttpStatusCode.NotFound, message: 'Position not found' }
      }

      const employeeCount = await db.Employee.count({
        where: { position_id: position.id },
        paranoid: false
      })

      if (employeeCount > 0) {
        throw {
          code: HttpStatusCode.Conflict,
          message: 'Cannot delete a position assigned to employees'
        }
      }

      const oldData = position.toJSON()
      await position.destroy()

      await createAuditLog({
        userId: req.user.id,
        action: 'DELETE',
        entity: 'Position',
        entityId: position.id,
        oldData
      })

      return res.status(HttpStatusCode.Ok).json(
        api({ id: position.id }, HttpStatusCode.Ok)
      )
    } catch (err) {
      return next(err)
    }
  }
}

module.exports = Controller
