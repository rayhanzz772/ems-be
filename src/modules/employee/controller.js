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
  static async getEmployees(req, res) {
    try {
      const limit = req.query.per_page || 10
      const page = req.query.page || 1
      const offset = (page - 1) * limit
      const q = req.query.q || null

      const conditions = []
      const replacements = { limit, offset }

      if (q) {
        conditions.push(`(
          LOWER(e.first_name) LIKE LOWER(:search) OR
          LOWER(e.last_name) LIKE LOWER(:search) OR
          LOWER(e.email) LIKE LOWER(:search)
        )`)
        replacements.search = `%${q.toLowerCase()}%`
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
        ORDER BY e.created_at DESC
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
      console.error(err)
      const code = err?.code ?? HttpStatusCode.InternalServerError
      return res.status(code).json(api(null, code, { err }))
    }
  }

  static async getEmployeeById(req, res) {
    try {
      const employee = await Employee.findByPk(req.params.id, {
        include: [{ model: db.Department, as: 'department' }]
      })

      if (!employee) {
        throw { code: HttpStatusCode.NotFound, message: 'Employee not found' }
      }

      return res.status(HTTP_OK).json(api(employee))
    } catch (err) {
      const code = err?.code ?? HttpStatusCode.InternalServerError
      return res.status(code).json(api(null, code, { err }))
    }
  }

  static async createEmployee(req, res) {
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
      const code = err?.code ?? HttpStatusCode.InternalServerError
      return res.status(code).json(api(null, code, { err }))
    }
  }

  static async updateEmployee(req, res) {
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
      const code = err?.code ?? HttpStatusCode.InternalServerError
      return res.status(code).json(api(null, code, { err }))
    }
  }

  static async deleteEmployee(req, res) {
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
      const code = err?.code ?? HttpStatusCode.InternalServerError
      return res.status(code).json(api(null, code, { err }))
    }
  }
}

module.exports = Controller