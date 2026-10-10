const { api } = require('../../../src/utils/api')
const db = require('../../../db/models')
const { HttpStatusCode } = require('axios')
const { validateRequest } = require('../../utils/validation')
const { createEmployeeSchema, updateEmployeeSchema } = require('./schema')
const { createAuditLog } = require('../../utils/auditLog')
const { createEmployeeWorkbook, createEmployeeCsv } = require('../../utils/excel')
const HTTP_OK = HttpStatusCode.Ok
const Employee = db.Employee
const { employeeCodeGenerator } = require('../../utils/employee-code')
const findEmployeesForExport = () =>
  db.sequelize.query(
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
      e.position_id,
      p.name AS position,
      e.branch_id,
      b.name AS branch_name,
      e.manager_id,
      m.first_name AS manager_first_name,
      m.last_name AS manager_last_name,
      e.employment_type,
      e.employment_status,
      e.contract_start_date,
      e.contract_end_date,
      e.status,
      e.hire_date,
      e.address,
      e.created_at,
      e.updated_at
    FROM employees e
    LEFT JOIN departments d ON d.id = e.department_id
    LEFT JOIN positions p ON p.id = e.position_id
    LEFT JOIN branches b ON b.id = e.branch_id
    LEFT JOIN employees m ON m.id = e.manager_id
    WHERE e.deleted_at IS NULL
    ORDER BY e.created_at DESC
    `,
    { type: db.Sequelize.QueryTypes.SELECT }
  )

const normalizeEmployeeBody = (body = {}) => ({
  employee_code: body.employee_code ?? body.employeeCode ?? employeeCodeGenerator(),
  first_name: body.first_name ?? body.firstName,
  last_name: body.last_name ?? body.lastName,
  email: body.email,
  phone_number: body.phone_number ?? body.phoneNumber,
  department_id: body.department_id ?? body.departmentId,
  position_id: body.position_id ?? body.positionId,
  manager_id: body.manager_id !== undefined ? body.manager_id : (body.managerId ?? null),
  branch_id: body.branch_id !== undefined ? body.branch_id : (body.branchId ?? null),
  employment_type: body.employment_type ?? body.employmentType ?? 'PERMANENT',
  employment_status: body.employment_status ?? body.employmentStatus ?? 'ACTIVE',
  contract_start_date: body.contract_start_date ?? body.contractStartDate ?? null,
  contract_end_date: body.contract_end_date ?? body.contractEndDate ?? null,
  status: body.status === undefined ? true : body.status,
  hire_date: body.hire_date ?? body.hireDate,
  address: body.address
})

const validateBranch = async (branchId) => {
  if (!branchId) return

  const branch = await db.Branch.findByPk(branchId)
  if (!branch) {
    throw { code: HttpStatusCode.BadRequest, message: 'Branch not found' }
  }
  if (!branch.status) {
    throw { code: HttpStatusCode.BadRequest, message: 'Branch is inactive' }
  }
}

const validateManager = async (managerId, employeeId = null) => {
  const visited = new Set()
  let currentManagerId = managerId

  while (currentManagerId) {
    if (currentManagerId === employeeId || visited.has(currentManagerId)) {
      throw {
        code: HttpStatusCode.BadRequest,
        message: 'Manager assignment would create a reporting cycle'
      }
    }

    visited.add(currentManagerId)
    const manager = await Employee.findByPk(currentManagerId, {
      attributes: ['id', 'manager_id']
    })

    if (!manager) {
      throw { code: HttpStatusCode.BadRequest, message: 'Manager not found' }
    }

    currentManagerId = manager.manager_id
  }
}


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
        position: 'p.name',
        branch_name: 'b.name',
        employment_type: 'e.employment_type',
        employment_status: 'e.employment_status',
        status: 'e.status',
        hire_date: 'e.hire_date',
        created_at: 'e.created_at',
        updated_at: 'e.updated_at'
      }
      const sortColumn = Object.prototype.hasOwnProperty.call(sortColumns, sortBy)
        ? sortColumns[sortBy]
        : 'e.created_at'
      const sortOrder = sortOrderValue?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'

      const conditions = ['e.deleted_at IS NULL']
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

      for (const [key, column, allowedValues] of [
        ['employment_type', 'e.employment_type', ['PERMANENT', 'CONTRACT', 'INTERN']],
        ['employment_status', 'e.employment_status', ['ACTIVE', 'ON_LEAVE', 'RESIGNED', 'TERMINATED']]
      ]) {
        const value = getQueryString(key)
        if (value) {
          const normalizedValue = value.toUpperCase()
          if (!allowedValues.includes(normalizedValue)) {
            throw {
              code: HttpStatusCode.BadRequest,
              message: `Invalid ${key} query parameter`
            }
          }
          conditions.push(`${column} = :${key}`)
          replacements[key] = normalizedValue
        }
      }

      const managerId = getQueryString('manager_id')
      if (managerId) {
        conditions.push('e.manager_id = :managerId')
        replacements.managerId = managerId
      }

      const branchId = getQueryString('branch_id')
      if (branchId) {
        conditions.push('e.branch_id = :branchId')
        replacements.branchId = branchId
      }

      const position = getQueryString('position')
      if (position) {
        conditions.push('LOWER(p.name) LIKE LOWER(:position)')
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
          e.position_id,
          p.name AS position,
          e.branch_id,
          b.name AS branch_name,
          e.manager_id,
          m.first_name AS manager_first_name,
          m.last_name AS manager_last_name,
          e.employment_type,
          e.employment_status,
          e.contract_start_date,
          e.contract_end_date,
          e.status,
          e.hire_date,
          e.address,
          e.created_at,
          e.updated_at
        FROM employees e
        LEFT JOIN departments d ON d.id = e.department_id
        LEFT JOIN positions p ON p.id = e.position_id
        LEFT JOIN branches b ON b.id = e.branch_id
        LEFT JOIN employees m ON m.id = e.manager_id
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
        LEFT JOIN positions p ON p.id = e.position_id
        LEFT JOIN branches b ON b.id = e.branch_id
        LEFT JOIN employees m ON m.id = e.manager_id
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
        include: [
          { model: db.Department, as: 'department' },
          { model: db.Position, as: 'position' },
          { model: db.Branch, as: 'branch' },
          {
            model: db.Employee,
            as: 'manager',
            attributes: ['id', 'employee_code', 'first_name', 'last_name']
          }
        ]
      })

      if (!employee) {
        throw { code: HttpStatusCode.NotFound, message: 'Employee not found' }
      }

      return res.status(HTTP_OK).json(api(employee))
    } catch (err) {
      return next(err)
    }
  }

  static async exportEmployeesCsv(req, res, next) {
    try {
      const employees = await findEmployeesForExport()
      const csv = await createEmployeeCsv(employees)
      const date = new Date().toISOString().slice(0, 10)

      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="employees-${date}.csv"`
      )

      return res.status(HTTP_OK).send(csv)
    } catch (err) {
      return next(err)
    }
  }

  static async createEmployee(req, res, next) {
    try {
      const payload = validateRequest(createEmployeeSchema, {
        body: normalizeEmployeeBody(req.body)
      })
      await validateBranch(payload.branch_id)
      await validateManager(payload.manager_id)

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

      const branch = await db.Branch.findByPk(payload.branch_id)

      if (!branch) {
        throw { code: HttpStatusCode.BadRequest, message: 'Branch not found' }
      }

      if (!branch.status) {
        throw { code: HttpStatusCode.BadRequest, message: 'Branch is inactive' }
      }

      await validateManager(payload.manager_id, employee.id)

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

  static async toggleEmployeeStatus(req, res, next) {
    try {
      const employee = await Employee.findByPk(req.params.id)

      if (!employee) {
        throw { code: HttpStatusCode.NotFound, message: 'Employee not found' }
      }

      const status = !employee.status
      await employee.update({ status })

      return res.status(HTTP_OK).json(api(null, HTTP_OK))
    } catch (err) {
      return next(err)
    }
  }

  static async getAllDepartments(req, res, next) {
    try {
      const departments = await db.Department.findAll({
        attributes: ['id', 'name'],
        order: [['name', 'ASC']],
        where: { status: true }
      })
      return res.status(HTTP_OK).json(api(departments, HTTP_OK))
    } catch (err) {
      return next(err)
    }
  }
}

module.exports = Controller