'use strict'

const cuid = require('cuid')
const { api } = require('../../../src/utils/api')
const db = require('../../../db/models')
const { HttpStatusCode } = require('axios')
const { validateRequest } = require('../../utils/validation')
const { createAuditLog } = require('../../utils/auditLog')
const { createBranchSchema, updateBranchSchema } = require('./schema')

const Branch = db.Branch

class Controller {
  static async getBranches(req, res, next) {
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
          conditions.push('(LOWER(b.name) LIKE LOWER(:search) OR LOWER(b.address) LIKE LOWER(:search))')
          replacements.search = `%${search}%`
        }
      }

      if (req.query.status !== undefined) {
        if (typeof req.query.status !== 'string' || !['true', 'false'].includes(req.query.status.toLowerCase())) {
          throw { code: HttpStatusCode.BadRequest, message: 'Status must be true or false' }
        }
        conditions.push('b.status = :status')
        replacements.status = req.query.status.toLowerCase() === 'true'
      }

      const sortColumns = {
        name: 'b.name',
        status: 'b.status',
        created_at: 'b.created_at',
        updated_at: 'b.updated_at'
      }
      const sortColumn = Object.prototype.hasOwnProperty.call(sortColumns, req.query.sort_by)
        ? sortColumns[req.query.sort_by]
        : 'b.created_at'
      const sortOrder = String(req.query.sort_order).toUpperCase() === 'ASC' ? 'ASC' : 'DESC'
      const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

      const rows = await db.sequelize.query(
        `
        SELECT
          b.id,
          b.name,
          b.address,
          b.status,
          b.created_at,
          b.updated_at,
          COUNT(e.id) AS employee_count
        FROM branches b
        LEFT JOIN employees e ON e.branch_id = b.id AND e.deleted_at IS NULL
        ${whereClause}
        GROUP BY b.id
        ORDER BY ${sortColumn} ${sortOrder}
        LIMIT :limit OFFSET :offset
        `,
        { type: db.Sequelize.QueryTypes.SELECT, replacements }
      )
      const countRows = await db.sequelize.query(
        `SELECT COUNT(*) AS total FROM branches b ${whereClause}`,
        { type: db.Sequelize.QueryTypes.SELECT, replacements }
      )

      return res.status(HttpStatusCode.Ok).json(
        api({ count: Number(countRows[0].total), rows }, HttpStatusCode.Ok, { req })
      )
    } catch (err) {
      return next(err)
    }
  }

  static async getBranchById(req, res, next) {
    try {
      const rows = await db.sequelize.query(
        `
        SELECT
          b.id,
          b.name,
          b.address,
          b.status,
          b.created_at,
          b.updated_at,
          COUNT(e.id) AS employee_count
        FROM branches b
        LEFT JOIN employees e ON e.branch_id = b.id AND e.deleted_at IS NULL
        WHERE b.id = :id
        GROUP BY b.id
        `,
        {
          type: db.Sequelize.QueryTypes.SELECT,
          replacements: { id: req.params.id }
        }
      )

      if (!rows.length) {
        throw { code: HttpStatusCode.NotFound, message: 'Branch not found' }
      }

      return res.status(HttpStatusCode.Ok).json(api(rows[0], HttpStatusCode.Ok))
    } catch (err) {
      return next(err)
    }
  }

  static async createBranch(req, res, next) {
    try {
      const payload = validateRequest(createBranchSchema, { body: req.body })
      const branch = await Branch.create({ id: cuid(), ...payload })

      await createAuditLog({
        userId: req.user.id,
        action: 'CREATE',
        entity: 'Branch',
        entityId: branch.id,
        newData: branch.toJSON()
      })

      return res.status(HttpStatusCode.Created).json(api(branch, HttpStatusCode.Created))
    } catch (err) {
      return next(err)
    }
  }

  static async updateBranch(req, res, next) {
    try {
      const branch = await Branch.findByPk(req.params.id)
      if (!branch) {
        throw { code: HttpStatusCode.NotFound, message: 'Branch not found' }
      }

      const payload = validateRequest(updateBranchSchema, { body: req.body })
      const oldData = branch.toJSON()
      await branch.update(payload)

      await createAuditLog({
        userId: req.user.id,
        action: 'UPDATE',
        entity: 'Branch',
        entityId: branch.id,
        oldData,
        newData: branch.toJSON()
      })

      return res.status(HttpStatusCode.Ok).json(api(branch, HttpStatusCode.Ok))
    } catch (err) {
      return next(err)
    }
  }

  static async deleteBranch(req, res, next) {
    try {
      const branch = await Branch.findByPk(req.params.id)
      if (!branch) {
        throw { code: HttpStatusCode.NotFound, message: 'Branch not found' }
      }

      const employeeCount = await db.Employee.count({
        where: { branch_id: branch.id },
        paranoid: false
      })
      if (employeeCount > 0) {
        throw {
          code: HttpStatusCode.Conflict,
          message: 'Cannot delete a branch assigned to employees'
        }
      }

      const oldData = branch.toJSON()
      await branch.destroy()

      await createAuditLog({
        userId: req.user.id,
        action: 'DELETE',
        entity: 'Branch',
        entityId: branch.id,
        oldData
      })

      return res.status(HttpStatusCode.Ok).json(
        api({ id: branch.id }, HttpStatusCode.Ok)
      )
    } catch (err) {
      return next(err)
    }
  }

  static async toggleBranchStatus(req, res, next) {
    try {
      const branch = await Branch.findByPk(req.params.id)
      if (!branch) {
        throw { code: HttpStatusCode.NotFound, message: 'Branch not found' }
      }

      const oldData = branch.toJSON()
      await branch.update({ status: !branch.status })

      await createAuditLog({
        userId: req.user.id,
        action: 'UPDATE',
        entity: 'Branch',
        entityId: branch.id,
        oldData,
        newData: branch.toJSON()
      })

      return res.status(HttpStatusCode.Ok).json(api(null, HttpStatusCode.Ok))
    } catch (err) {
      return next(err)
    }
  }
}

module.exports = Controller