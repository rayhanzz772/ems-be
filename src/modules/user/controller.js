const { api } = require('../../../src/utils/api')
const db = require('../../../db/models')
const { HttpStatusCode } = require('axios')
const cuid = require('cuid')
const { hashPassword } = require('../../utils/argon')
const { validateRequest } = require('../../utils/validation')
const { createAuditLog } = require('../../utils/auditLog')
const { createUserSchema, updateUserSchema } = require('./schema')
const HTTP_OK = HttpStatusCode.Ok
const User = db.User

const getPublicUser = (user) => {
  const data = user.toJSON()
  delete data.password
  delete data.role_id
  if (data.role) {
    data.role = data.role.name || data.role
  }
  return data
}

const resolveRoleId = async (roleName) => {
  const role = await db.Role.findOne({ where: { name: String(roleName).toUpperCase() } })

  if (!role) {
    throw { code: HttpStatusCode.BadRequest, message: 'Invalid role' }
  }

  return role.id
}

class Controller {
  static async getUser(req, res, next) {
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
      const q = req.query.q || ''

      const conditions = ['u.deleted_at IS NULL']
      const replacements = { limit, offset }

      if (q) {
        conditions.push('LOWER(u.email) LIKE LOWER(:search)')
        replacements.search = `%${String(q).toLowerCase()}%`
      }

      if (req.query.role) {
        const role = String(req.query.role).toUpperCase()
        if (!['ADMIN', 'HR', 'EMPLOYEE'].includes(role)) {
          throw { code: HttpStatusCode.BadRequest, message: 'Invalid role filter' }
        }
        conditions.push('LOWER(r.name) = LOWER(:role)')
        replacements.role = role
      }

      if (req.query.status !== undefined) {
        const status = String(req.query.status).toLowerCase()
        if (!['true', 'false'].includes(status)) {
          throw { code: HttpStatusCode.BadRequest, message: 'Status must be true or false' }
        }
        conditions.push('u.status = :status')
        replacements.status = status === 'true'
      }

      const sortColumns = {
        email: 'u.email',
        role: 'r.name',
        status: 'u.status',
        created_at: 'u.created_at'
      }
      const sortColumn = Object.prototype.hasOwnProperty.call(sortColumns, req.query.sort_by)
        ? sortColumns[req.query.sort_by]
        : 'u.id'
      const sortOrder = String(req.query.sort_order).toUpperCase() === 'ASC' ? 'ASC' : 'DESC'
      const whereClause = `WHERE ${conditions.join(' AND ')}`

      const results = await db.sequelize.query(
        `
        SELECT
          u.id,
          u.email,
          r.name AS role,
          u.status,
          u.created_at,
          u.updated_at
        FROM users u
        LEFT JOIN roles r ON r.id = u.role_id
        ${whereClause}
        ORDER BY ${sortColumn} ${sortOrder}
        LIMIT :limit OFFSET :offset
        `,
        {
          type: db.Sequelize.QueryTypes.SELECT,
          replacements
        }
      )

      const countResult = await db.sequelize.query(
        `
        SELECT
          COUNT(*) AS total
        FROM users u
        LEFT JOIN roles r ON r.id = u.role_id
        ${whereClause}
      `,
        {
          type: db.Sequelize.QueryTypes.SELECT,
          replacements
        }
      )

      const result = {
        count: parseInt(countResult[0].total, 10),
        rows: results
      }

      return res.status(HTTP_OK).json(api(result))
    } catch (err) {
      return next(err)
    }
  }

  static async getUserById(req, res, next) {
    try {
      const user = await User.findByPk(req.params.id, {
        attributes: { exclude: ['password', 'role_id'] },
        include: [{ model: db.Role, as: 'role', attributes: ['id', 'name'] }]
      })

      if (!user) {
        throw { code: HttpStatusCode.NotFound, message: 'User not found' }
      }

      return res.status(HTTP_OK).json(api(getPublicUser(user)))
    } catch (err) {
      return next(err)
    }
  }

  static async createUser(req, res, next) {
    try {
      const payload = validateRequest(createUserSchema, { body: req.body })
      const roleId = await resolveRoleId(payload.role || 'EMPLOYEE')

      const user = await User.create({
        id: cuid(),
        email: payload.email,
        role_id: roleId,
        status: payload.status,
        password: await hashPassword(payload.password)
      })

      await createAuditLog({
        userId: req.user.id,
        action: 'CREATE',
        entity: 'User',
        entityId: user.id,
        newData: getPublicUser(user)
      })

      return res.status(HttpStatusCode.Created).json(api(null, HttpStatusCode.Created))
    } catch (err) {
      return next(err)
    }
  }

  static async updateUser(req, res, next) {
    try {
      const user = await User.findByPk(req.params.id, {
        include: [{ model: db.Role, as: 'role', attributes: ['id', 'name'] }]
      })

      if (!user) {
        throw { code: HttpStatusCode.NotFound, message: 'User not found' }
      }

      const payload = validateRequest(updateUserSchema, { body: req.body })
      const oldData = getPublicUser(user)
      const updates = { ...payload }

      if (updates.role) {
        updates.role_id = await resolveRoleId(updates.role)
        delete updates.role
      }

      if (updates.password) {
        updates.password = await hashPassword(updates.password)
      }

      await user.update(updates)

      const updatedUser = await User.findByPk(req.params.id, {
        include: [{ model: db.Role, as: 'role', attributes: ['id', 'name'] }]
      })

      await createAuditLog({
        userId: req.user.id,
        action: 'UPDATE',
        entity: 'User',
        entityId: user.id,
        oldData,
        newData: getPublicUser(updatedUser)
      })

      return res.status(HTTP_OK).json(api(null, HTTP_OK))
    } catch (err) {
      return next(err)
    }
  }

  static async deleteUser(req, res, next) {
    try {
      const user = await User.findByPk(req.params.id)

      if (!user) {
        throw { code: HttpStatusCode.NotFound, message: 'User not found' }
      }

      const oldData = getPublicUser(user)
      await user.destroy()

      await createAuditLog({
        userId: req.user.id,
        action: 'DELETE',
        entity: 'User',
        entityId: user.id,
        oldData
      })

      return res.status(HTTP_OK).json(api(null, HTTP_OK))
    } catch (err) {
      return next(err)
    }
  }

  static async updateUserStatus(req, res, next) {
    try {
      const user = await User.findByPk(req.params.id)

      if (!user) {
        throw { code: HttpStatusCode.NotFound, message: 'User not found' }
      }

      const oldData = getPublicUser(user)
      const status = !user.status
      await user.update({ status })

      await createAuditLog({
        userId: req.user.id,
        action: 'UPDATE',
        entity: 'User',
        entityId: user.id,
        oldData,
        newData: getPublicUser(user)
      })

      return res.status(HTTP_OK).json(api(null, HTTP_OK))
    } catch (err) {
      return next(err)
    }
  }

  static async getAllRoles(req, res, next) {
    try {
      const roles = await db.Role.findAll({
        attributes: ['id', 'name', 'status', 'created_at', 'updated_at'],
        order: [['name', 'ASC']],
        where: { status: true }
      })
      return res.status(HTTP_OK).json(api(roles, HTTP_OK))
    } catch (err) {
      return next(err)
    }
  }
}

module.exports = Controller