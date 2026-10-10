const { api } = require('../../utils/api')
const db = require('../../../db/models')
const { HttpStatusCode } = require('axios')

class Controller {
  static async getDashboard(req, res, next) {
    try {
      const [departmentSummary, employeeStatus, employmentStatusSummary, recentActivity] = await Promise.all([
        db.sequelize.query(
          `
          SELECT
            d.id,
            d.name AS department_name,
            COUNT(e.id) AS employee_count
          FROM departments d
          LEFT JOIN employees e
            ON e.department_id = d.id
           AND e.deleted_at IS NULL
           AND e.status = true
          WHERE d.status = true
          GROUP BY d.id, d.name
          ORDER BY employee_count DESC, d.name ASC
          LIMIT 5
          `,
          { type: db.Sequelize.QueryTypes.SELECT }
        ),
        db.sequelize.query(
          `
          SELECT
            SUM(CASE WHEN status = true THEN 1 ELSE 0 END) AS active,
            SUM(CASE WHEN status = false THEN 1 ELSE 0 END) AS inactive,
            COUNT(*) AS total
          FROM employees
            WHERE deleted_at IS NULL
          `,
          { type: db.Sequelize.QueryTypes.SELECT }
        ),
        db.sequelize.query(
          `
          SELECT employment_status, COUNT(*) AS total
          FROM employees
          WHERE deleted_at IS NULL
          GROUP BY employment_status
          `,
          { type: db.Sequelize.QueryTypes.SELECT }
        ),
        db.sequelize.query(
          `
          SELECT
            a.id,
            a.action,
            a.entity,
            a.entity_id,
            u.email AS user_email,
            a.created_at
          FROM audit_logs a
          LEFT JOIN users u ON u.id = a.user_id
          ORDER BY a.created_at DESC
          LIMIT 5
          `,
          { type: db.Sequelize.QueryTypes.SELECT }
        )
      ])

      const employeeStatusSummary = employeeStatus[0] || {
        active: 0,
        inactive: 0,
        total: 0
      }

      const dashboardData = {
        total_employees: Number(employeeStatusSummary.total || 0),
        active_employees: Number(employeeStatusSummary.active || 0),
        inactive_employees: Number(employeeStatusSummary.inactive || 0),
        employee_status: {
          active: Number(employeeStatusSummary.active || 0),
          inactive: Number(employeeStatusSummary.inactive || 0),
          total: Number(employeeStatusSummary.total || 0)
        },
        employment_status_summary: Object.fromEntries(
          employmentStatusSummary.map((item) => [
            item.employment_status,
            Number(item.total || 0)
          ])
        ),
        employee_by_department: departmentSummary.map((item) => ({
          department_id: item.id,
          department_name: item.department_name,
          employee_count: Number(item.employee_count || 0)
        })),
        department_overview: departmentSummary.map((item) => ({
          department_name: item.department_name,
          employee_count: Number(item.employee_count || 0)
        })),
        recent_activity: recentActivity.map((item) => ({
          id: item.id,
          action: item.action,
          entity: item.entity,
          entity_id: item.entity_id,
          user_email: item.user_email,
          created_at: item.created_at
        }))
      }

      return res.status(HttpStatusCode.Ok).json(api(dashboardData, HttpStatusCode.Ok, { req }))
    } catch (err) {
      return next(err)
    }
  }
}

module.exports = Controller
