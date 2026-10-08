const { api } = require('../../../src/utils/api')
const db = require('../../../db/models')
const { HttpStatusCode } = require('axios')
const { validateRequest } = require('../../utils/validation')
const { createEmployeeSchema, updateEmployeeSchema } = require('./schema')
const { createAuditLog } = require('../../utils/auditLog')
const HTTP_OK = HttpStatusCode.Ok
const Employee = db.Employee
const { employeeCodeGenerator } = require('../../utils/employee-code')

const normalizeEmployeeBody = (body = {}) => ({
  employee_code: employeeCodeGenerator(),
  first_name: body.first_name ?? body.firstName,
  last_name: body.last_name ?? body.lastName,
  email: body.email,
  phone_number: body.phone_number ?? body.phoneNumber,
  department_id: body.department_id ?? body.departmentId,
  position: body.position,
  status: body.status === undefined ? true : body.status,
  hire_date: body.hire_date ?? body.hireDate,
  address: body.address
})


class Controller {
  static async getEmployees(req, res, next) {
    try {
      const getQueryString = (key) => {
        const value = req.query[key]
        if (value === undefined) return undefined
        if (typeof value !== 'string') {
          throw { code: HttpStatusCode.BadRequest, message: `Invalid ${key} query parameter` }
        }
        return value.trim()
      }

      const parsePositiveInteger = (value, fallback, maximum = Number.MAX_SAFE_INTEGER) => {
        const parsed = Number(value)
        return Number.isInteger(parsed) && parsed > 0
          ? Math.min(parsed, maximum)
          : fallback
      }

      const limit = parsePositiveInteger(req.query.per_page, 10, 100)
      const page = parsePositiveInteger(req.query.page, 1)
      const offset = (page - 1) * limit
      const q = getQueryString('q') || ''
      const sortBy = getQueryString('sort_by')
      const sortOrderValue = getQueryString('sort_order')
      const sortColumns = {
        employee_code: 'e.employee_code',
        first_name: 'e.first_name',
        last_name: 'e.last_name',
        email: 'e.email',
        department_name: 'd.name',
        position: 'e.position',
        status: 'e.status',
        hire_date: 'e.hire_date',
        created_at: 'e.created_at',
        updated_at: 'e.updated_at'
      }
      const sortColumn = Object.prototype.hasOwnProperty.call(sortColumns, sortBy)
        ? sortColumns[sortBy]
        : 'e.created_at'
      const sortOrder = sortOrderValue?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'

      const conditions = []
      const replacements = { limit, offset }

      if (q) {
        conditions.push(`(
          LOWER(e.first_name) LIKE LOWER(:search) OR
          LOWER(e.last_name) LIKE LOWER(:search) OR
          LOWER(e.email) LIKE LOWER(:search)
        )`)
        replacements.search = `%${q}%`
      }

      const statusFilter = getQueryString('status')
      if (statusFilter !== undefined) {
        const status = statusFilter.toLowerCase()
        if (!['true', 'false'].includes(status)) {
          throw { code: HttpStatusCode.BadRequest, message: 'Status must be true or false' }
        }
        conditions.push('e.status = :status')
        replacements.status = status === 'true'
      }

      const departmentId = getQueryString('department_id')
      if (departmentId) {
        conditions.push('e.department_id = :departmentId')
        replacements.departmentId = departmentId
      }

      const position = getQueryString('position')
      if (position) {
        conditions.push('LOWER(e.position) LIKE LOWER(:position)')
        replacements.position = `%${position}%`
      }

      const hireDateFrom = getQueryString('hire_date_from')
      const hireDateTo = getQueryString('hire_date_to')
      if (hireDateFrom && Number.isNaN(Date.parse(hireDateFrom))) {
        throw { code: HttpStatusCode.BadRequest, message: 'Invalid hire_date_from date' }
      }
      if (hireDateTo && Number.isNaN(Date.parse(hireDateTo))) {
        throw { code: HttpStatusCode.BadRequest, message: 'Invalid hire_date_to date' }
      }
      if (hireDateFrom && hireDateTo && new Date(hireDateFrom) > new Date(hireDateTo)) {
        throw { code: HttpStatusCode.BadRequest, message: 'hire_date_from must be before hire_date_to' }
      }
      if (hireDateFrom) {
        conditions.push('e.hire_date >= :hireDateFrom')
        replacements.hireDateFrom = hireDateFrom
      }
      if (hireDateTo) {
        conditions.push('e.hire_date <= :hireDateTo')
        replacements.hireDateTo = hireDateTo
      }

      const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

      const results = await db.sequelize.query(
        `
        SELECT
          e.id,
          e.employee_code,
          e.first_name,
          e.last_name,
          e.email,
          e.phone_number,
          e.department_id,
          d.name AS department_name,
          e.position,
          e.status,
          e.hire_date,
          e.address,
          e.created_at,
          e.updated_at
        FROM employees e
        LEFT JOIN departments d ON d.id = e.department_id
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
        SELECT COUNT(*) AS total
        FROM employees e
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

  static async getEmployeeById(req, res, next) {
    try {
      const employee = await Employee.findByPk(req.params.id, {
        include: [{ model: db.Department, as: 'department' }]
      })

      if (!employee) {
        throw { code: HttpStatusCode.NotFound, message: 'Employee not found' }
      }

      return res.status(HTTP_OK).json(api(employee))
    } catch (err) {
      return next(err)
    }
  }

  static async createEmployee(req, res, next) {
    try {
      const payload = validateRequest(createEmployeeSchema, {
        body: normalizeEmployeeBody(req.body)
      })

      const employee = await Employee.create(payload)

      await createAuditLog({
        userId: req.user?.id,
        action: 'CREATE',
        entity: 'Employee',
        entityId: employee.id,
        oldData: null,
        newData: employee.toJSON()
      })

      return res.status(HttpStatusCode.Created).json(api(null, HttpStatusCode.Created))
    } catch (err) {
      return next(err)
    }
  }

  static async updateEmployee(req, res, next) {
    try {
      const employee = await Employee.findByPk(req.params.id)

      if (!employee) {
        throw { code: HttpStatusCode.NotFound, message: 'Employee not found' }
      }

      const payload = validateRequest(updateEmployeeSchema, {
        body: normalizeEmployeeBody({ ...employee.toJSON(), ...req.body })
      })

      const previousData = employee.toJSON()

      await employee.update(payload)

      await createAuditLog({
        userId: req.user?.id,
        action: 'UPDATE',
        entity: 'Employee',
        entityId: employee.id,
        oldData: previousData,
        newData: employee.toJSON()
      })

      return res.status(HTTP_OK).json(api(null, HTTP_OK))
    } catch (err) {
      return next(err)
    }
  }

  static async deleteEmployee(req, res, next) {
    try {
      const employee = await Employee.findByPk(req.params.id)

      if (!employee) {
        throw { code: HttpStatusCode.NotFound, message: 'Employee not found' }
      }

      const deletedData = employee.toJSON()

      await employee.destroy()

      await createAuditLog({
        userId: req.user?.id,
        action: 'DELETE',
        entity: 'Employee',
        entityId: employee.id,
        oldData: deletedData,
        newData: null
      })

      return res.status(HTTP_OK).json(api({ id: employee.id }))
    } catch (err) {
      return next(err)
    }
  }
}

module.exports = Controller