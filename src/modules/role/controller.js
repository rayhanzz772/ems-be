const cuid = require('cuid')
const { api } = require('../../../src/utils/api')
const db = require('../../../db/models')
const { HttpStatusCode } = require('axios')
const { validateRequest } = require('../../utils/validation')
const { createAuditLog } = require('../../utils/auditLog')
const { createRoleSchema, updateRoleSchema } = require('./schema')

const Role = db.Role

class Controller {
  static async getRoles(req, res, next) {
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
      const conditions = ['r.deleted_at IS NULL']
      const replacements = { limit, offset }

      if (req.query.q !== undefined) {
        if (typeof req.query.q !== 'string') {
          throw { code: HttpStatusCode.BadRequest, message: 'Invalid q query parameter' }
        }

        const search = req.query.q.trim()
        if (search) {
          conditions.push('(LOWER(r.name) LIKE LOWER(:search) OR LOWER(r.description) LIKE LOWER(:search))')
          replacements.search = `%${search}%`
        }
      }

      if (req.query.status !== undefined) {
        const statusValue = String(req.query.status).toLowerCase()
        if (!['true', 'false'].includes(statusValue)) {
          throw { code: HttpStatusCode.BadRequest, message: 'Status must be true or false' }
        }
        conditions.push('r.status = :status')
        replacements.status = statusValue === 'true'
      }

      const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
      const sortColumns = {
        name: 'r.name',
        status: 'r.status',
        created_at: 'r.created_at',
        updated_at: 'r.updated_at'
      }
      const sortColumn = Object.prototype.hasOwnProperty.call(sortColumns, req.query.sort_by)
        ? sortColumns[req.query.sort_by]
        : 'r.created_at'
      const sortOrder = String(req.query.sort_order).toUpperCase() === 'ASC' ? 'ASC' : 'DESC'

      const rows = await db.sequelize.query(
        `
        SELECT
          r.id,
          r.name,
          r.description,
          r.status,
          r.created_at,
          r.updated_at
        FROM roles r
        ${whereClause}
        ORDER BY ${sortColumn} ${sortOrder}
        LIMIT :limit OFFSET :offset
        `,
        { type: db.Sequelize.QueryTypes.SELECT, replacements }
      )

      const countRows = await db.sequelize.query(
        `SELECT COUNT(*) AS total FROM roles r ${whereClause}`,
        { type: db.Sequelize.QueryTypes.SELECT, replacements }
      )

      return res.status(HttpStatusCode.Ok).json(
        api({ count: Number(countRows[0].total), rows }, HttpStatusCode.Ok, { req })
      )
    } catch (err) {
      return next(err)
    }
  }

  static async getRoleById(req, res, next) {
    try {
      const role = await Role.findByPk(req.params.id)

      if (!role) {
        throw { code: HttpStatusCode.NotFound, message: 'Role not found' }
      }

      return res.status(HttpStatusCode.Ok).json(api(role, HttpStatusCode.Ok))
    } catch (err) {
      return next(err)
    }
  }

  static async createRole(req, res, next) {
    try {
      const payload = validateRequest(createRoleSchema, { body: req.body })
      const role = await Role.create({ id: cuid(), ...payload })

      await createAuditLog({
        userId: req.user.id,
        action: 'CREATE',
        entity: 'Role',
        entityId: role.id,
        newData: role.toJSON()
      })

      return res.status(HttpStatusCode.Created).json(api(role, HttpStatusCode.Created))
    } catch (err) {
      return next(err)
    }
  }

  static async updateRole(req, res, next) {
    try {
      const role = await Role.findByPk(req.params.id)

      if (!role) {
        throw { code: HttpStatusCode.NotFound, message: 'Role not found' }
      }

      const payload = validateRequest(updateRoleSchema, { body: req.body })
      const oldData = role.toJSON()
      await role.update(payload)

      await createAuditLog({
        userId: req.user.id,
        action: 'UPDATE',
        entity: 'Role',
        entityId: role.id,
        oldData,
        newData: role.toJSON()
      })

      return res.status(HttpStatusCode.Ok).json(api(role, HttpStatusCode.Ok))
    } catch (err) {
      return next(err)
    }
  }

  static async deleteRole(req, res, next) {
    try {
      const role = await Role.findByPk(req.params.id)

      if (!role) {
        throw { code: HttpStatusCode.NotFound, message: 'Role not found' }
      }

      const userCount = await db.User.count({ where: { role_id: role.id } })
      if (userCount > 0) {
        throw {
          code: HttpStatusCode.Conflict,
          message: 'Cannot delete a role assigned to users'
        }
      }

      const oldData = role.toJSON()
      await role.destroy()

      await createAuditLog({
        userId: req.user.id,
        action: 'DELETE',
        entity: 'Role',
        entityId: role.id,
        oldData
      })

      return res.status(HttpStatusCode.Ok).json(api({ id: role.id }, HttpStatusCode.Ok))
    } catch (err) {
      return next(err)
    }
  }

  static async toggleRoleStatus(req, res, next) {
    try {
      const role = await Role.findByPk(req.params.id)
      const userRole = req.user.role

      if (userRole !== 'ADMIN') {
        return next({ statusCode: 403, message: 'Admin role is required to toggle role status' })
      }

      if (userRole === 'ADMIN' && role.name === 'ADMIN') {
        return next({ statusCode: 403, message: 'Cannot toggle status of ADMIN role' })
      }

      if (!role) {
        throw { code: HttpStatusCode.NotFound, message: 'Role not found' }
      }

      const oldData = role.toJSON()
      await role.update({ status: !role.status })

      await createAuditLog({
        userId: req.user.id,
        action: 'UPDATE',
        entity: 'Role',
        entityId: role.id,
        oldData,
        newData: role.toJSON()
      })

      return res.status(HttpStatusCode.Ok).json(api(role, HttpStatusCode.Ok))
    } catch (err) {
      return next(err)
    }
  }
}
module.exports = Controller
