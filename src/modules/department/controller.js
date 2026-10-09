const cuid = require('cuid')
const { api } = require('../../../src/utils/api')
const db = require('../../../db/models')
const { HttpStatusCode } = require('axios')
const { validateRequest } = require('../../utils/validation')
const { createAuditLog } = require('../../utils/auditLog')
const { createDepartmentSchema, updateDepartmentSchema } = require('./schema')
const HTTP_OK = HttpStatusCode.Ok
const Department = db.Department

const getPublicUser = (user) => {
  const data = user.toJSON()
  delete data.password
  return data
}

class Controller {
	static async getDepartments(req, res, next) {
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
					conditions.push('(LOWER(d.name) LIKE LOWER(:search) OR LOWER(d.description) LIKE LOWER(:search))')
					replacements.search = `%${search}%`
				}
			}

			if (req.query.status !== undefined) {
				const statusValue = String(req.query.status).toLowerCase()
				if (!['true', 'false'].includes(statusValue)) {
					throw { code: HttpStatusCode.BadRequest, message: 'Status must be true or false' }
				}
				conditions.push('d.status = :status')
				replacements.status = statusValue === 'true'
			}

			const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
			const sortColumns = {
				name: 'd.name',
				status: 'd.status',
				created_at: 'd.created_at',
				updated_at: 'd.updated_at'
			}
			const sortColumn = Object.prototype.hasOwnProperty.call(sortColumns, req.query.sort_by)
				? sortColumns[req.query.sort_by]
				: 'd.created_at'
			const sortOrder = String(req.query.sort_order).toUpperCase() === 'ASC' ? 'ASC' : 'DESC'

			const rows = await db.sequelize.query(
				`
				SELECT 
					d.id, 
					d.name, 
					d.description,
					d.status,
					d.created_at, 
					d.updated_at,
					d.status,
					COUNT(e.id) AS employee_count
				FROM departments d
				LEFT JOIN employees e ON e.department_id = d.id AND e.deleted_at IS NULL
				${whereClause}
				GROUP BY d.id
				ORDER BY ${sortColumn} ${sortOrder}
				LIMIT :limit OFFSET :offset
				`,
				{ type: db.Sequelize.QueryTypes.SELECT, replacements }
			)
			const countRows = await db.sequelize.query(
				`SELECT COUNT(*) AS total FROM departments d ${whereClause}`,
				{ type: db.Sequelize.QueryTypes.SELECT, replacements }
			)

			return res.status(HttpStatusCode.Ok).json(
				api({ count: Number(countRows[0].total), rows }, HttpStatusCode.Ok, { req })
			)
		} catch (err) {
			return next(err)
		}
	}

	static async getDepartmentById(req, res, next) {
		try {
			const department = await db.sequelize.query(
				`
				SELECT
					d.id, 
					d.name, 
					d.description,
					d.status,
					d.created_at, 
					d.updated_at,
					COUNT(e.id) AS employee_count
				FROM departments d
				LEFT JOIN employees e ON e.department_id = d.id AND e.deleted_at IS NULL AND e.status = true
				WHERE d.id = :id
				GROUP BY d.id
				`,
				{ type: db.Sequelize.QueryTypes.SELECT, replacements: { id: req.params.id } }
			)

			if (!department) {
				throw { code: HttpStatusCode.NotFound, message: 'Department not found' }
			}

			return res.status(HttpStatusCode.Ok).json(api(department, HttpStatusCode.Ok))
		} catch (err) {
			return next(err)
		}
	}

	static async createDepartment(req, res, next) {
		try {
			const payload = validateRequest(createDepartmentSchema, { body: req.body })
			const department = await Department.create({ id: cuid(), ...payload })

			await createAuditLog({
				userId: req.user.id,
				action: 'CREATE',
				entity: 'Department',
				entityId: department.id,
				newData: department.toJSON()
			})

			return res
				.status(HttpStatusCode.Created)
				.json(api(department, HttpStatusCode.Created))
		} catch (err) {
			return next(err)
		}
	}

	static async updateDepartment(req, res, next) {
		try {
			const department = await Department.findByPk(req.params.id)

			if (!department) {
				throw { code: HttpStatusCode.NotFound, message: 'Department not found' }
			}

			const payload = validateRequest(updateDepartmentSchema, { body: req.body })
			const oldData = department.toJSON()
			await department.update(payload)

			await createAuditLog({
				userId: req.user.id,
				action: 'UPDATE',
				entity: 'Department',
				entityId: department.id,
				oldData,
				newData: department.toJSON()
			})

			return res.status(HttpStatusCode.Ok).json(api(department, HttpStatusCode.Ok))
		} catch (err) {
			return next(err)
		}
	}

	static async deleteDepartment(req, res, next) {
		try {
			const department = await Department.findByPk(req.params.id)

			if (!department) {
				throw { code: HttpStatusCode.NotFound, message: 'Department not found' }
			}

			const employeeCount = await db.Employee.count({
				where: { department_id: department.id }
			})

			if (employeeCount > 0) {
				throw {
					code: HttpStatusCode.Conflict,
					message: 'Cannot delete a department assigned to employees'
				}
			}

			const oldData = department.toJSON()
			await department.destroy()

			await createAuditLog({
				userId: req.user.id,
				action: 'DELETE',
				entity: 'Department',
				entityId: department.id,
				oldData
			})

			return res
				.status(HttpStatusCode.Ok)
				.json(api({ id: department.id }, HttpStatusCode.Ok))
		} catch (err) {
			return next(err)
		}
	}

	static async toggleDepartmentStatus(req, res, next) {
		 try {
				const department = await Department.findByPk(req.params.id)
	
				if (!department) {
					throw { code: HttpStatusCode.NotFound, message: 'Department not found' }
				}
	
				const oldData = getPublicUser(department)
				const status = !department.status
				await department.update({ status })
	
				await createAuditLog({
					userId: req.user.id,
					action: 'UPDATE',
					entity: 'Department',
					entityId: department.id,
					oldData,
					newData: getPublicUser(department)
				})
	
				return res.status(HTTP_OK).json(api(null, HTTP_OK))
			} catch (err) {
				return next(err)
			}
	}
}

module.exports = Controller
