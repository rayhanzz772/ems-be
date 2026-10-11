const { api } = require('../../utils/api')
const db = require('../../../db/models')
const { HttpStatusCode } = require('axios')

class Controller {
  static async getDashboard(req, res, next) {
    try {
      const [
        departmentSummary,
        employeeStatus,
        employmentStatusSummary,
        recentActivity,
        branchSummary,
        positionSummary,
        leaveStatusSummary,
        onLeaveToday,
        upcomingLeaves,
        pendingLeaveRequests,
        leaveByType
      ] = await Promise.all([
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
        ),
        db.sequelize.query(
          `
          SELECT
            b.id,
            b.name AS branch_name,
            COUNT(e.id) AS employee_count
          FROM branches b
          LEFT JOIN employees e
            ON e.branch_id = b.id
           AND e.deleted_at IS NULL
           AND e.status = true
          WHERE b.status = true
          GROUP BY b.id, b.name
          ORDER BY employee_count DESC, b.name ASC
          `,
          { type: db.Sequelize.QueryTypes.SELECT }
        ),
        db.sequelize.query(
          `
          SELECT
            p.id,
            p.name AS position_name,
            COUNT(e.id) AS employee_count
          FROM positions p
          LEFT JOIN employees e
            ON e.position_id = p.id
           AND e.deleted_at IS NULL
           AND e.status = true
          GROUP BY p.id, p.name
          ORDER BY employee_count DESC, p.name ASC
          `,
          { type: db.Sequelize.QueryTypes.SELECT }
        ),
        db.sequelize.query(
          `
          SELECT status, COUNT(*) AS total
          FROM leave_requests
          GROUP BY status
          `,
          { type: db.Sequelize.QueryTypes.SELECT }
        ),
        db.sequelize.query(
          `
          SELECT
            lr.id,
            e.id AS employee_id,
            e.employee_code,
            e.first_name,
            e.last_name,
            lt.name AS leave_type,
            lt.color AS leave_type_color,
            lr.start_date,
            lr.end_date,
            lr.duration_days,
            COUNT(*) OVER () AS total
          FROM leave_requests lr
          JOIN employees e
            ON e.id = lr.employee_id
           AND e.deleted_at IS NULL
          JOIN leave_types lt ON lt.id = lr.leave_type_id
          WHERE lr.status = 'APPROVED'
            AND CURRENT_DATE BETWEEN lr.start_date AND lr.end_date
          ORDER BY lr.end_date ASC
          `,
          { type: db.Sequelize.QueryTypes.SELECT }
        ),
        db.sequelize.query(
          `
          SELECT
            lr.id,
            e.id AS employee_id,
            e.employee_code,
            e.first_name,
            e.last_name,
            lt.name AS leave_type,
            lt.color AS leave_type_color,
            lr.start_date,
            lr.end_date,
            lr.duration_days
          FROM leave_requests lr
          JOIN employees e
            ON e.id = lr.employee_id
           AND e.deleted_at IS NULL
          JOIN leave_types lt ON lt.id = lr.leave_type_id
          WHERE lr.status = 'APPROVED'
            AND lr.start_date > CURRENT_DATE
            AND lr.start_date <= CURRENT_DATE + INTERVAL '7 days'
          ORDER BY lr.start_date ASC
          LIMIT 5
          `,
          { type: db.Sequelize.QueryTypes.SELECT }
        ),
        db.sequelize.query(
          `
          SELECT
            lr.id,
            e.id AS employee_id,
            e.employee_code,
            e.first_name,
            e.last_name,
            lt.name AS leave_type,
            lt.color AS leave_type_color,
            lr.start_date,
            lr.end_date,
            lr.duration_days,
            lr.created_at
          FROM leave_requests lr
          JOIN employees e
            ON e.id = lr.employee_id
           AND e.deleted_at IS NULL
          JOIN leave_types lt ON lt.id = lr.leave_type_id
          WHERE lr.status = 'PENDING'
          ORDER BY lr.created_at ASC
          LIMIT 5
          `,
          { type: db.Sequelize.QueryTypes.SELECT }
        ),
        db.sequelize.query(
          `
          SELECT
            lt.id,
            lt.name,
            lt.color,
            COUNT(lr.id) AS total_requests,
            COALESCE(SUM(lr.duration_days), 0) AS total_days
          FROM leave_types lt
          LEFT JOIN leave_requests lr
            ON lr.leave_type_id = lt.id
           AND lr.status = 'APPROVED'
           AND EXTRACT(YEAR FROM lr.start_date) = EXTRACT(YEAR FROM CURRENT_DATE)
          WHERE lt.is_active = true
          GROUP BY lt.id, lt.name, lt.color
          ORDER BY total_days DESC, lt.name ASC
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

      const leaveStatusSummaryData = Object.fromEntries(
        leaveStatusSummary.map((item) => [item.status, Number(item.total || 0)])
      )

      const leaveStatus = {
        pending: leaveStatusSummaryData.PENDING || 0,
        approved: leaveStatusSummaryData.APPROVED || 0,
        rejected: leaveStatusSummaryData.REJECTED || 0,
        cancelled: leaveStatusSummaryData.CANCELLED || 0
      }
      leaveStatus.total = Object.values(leaveStatus).reduce((sum, value) => sum + value, 0)

      const mapLeaveRow = (item) => ({
        id: item.id,
        employee_id: item.employee_id,
        employee_code: item.employee_code,
        employee_name: [item.first_name, item.last_name].filter(Boolean).join(' '),
        leave_type: item.leave_type,
        leave_type_color: item.leave_type_color,
        start_date: item.start_date,
        end_date: item.end_date,
        duration_days: Number(item.duration_days || 0)
      })

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
        })),
        total_branches: branchSummary.length,
        employee_by_branch: branchSummary.slice(0, 5).map((item) => ({
          branch_id: item.id,
          branch_name: item.branch_name,
          employee_count: Number(item.employee_count || 0)
        })),
        branch_overview: branchSummary.map((item) => ({
          branch_name: item.branch_name,
          employee_count: Number(item.employee_count || 0)
        })),
        total_positions: positionSummary.length,
        employee_by_position: positionSummary.slice(0, 5).map((item) => ({
          position_id: item.id,
          position_name: item.position_name,
          employee_count: Number(item.employee_count || 0)
        })),
        leave_status: leaveStatus,
        leave_status_summary: leaveStatus,
        total_leave_requests: leaveStatus.total,
        pending_leave_requests_count: leaveStatus.pending,
        employees_on_leave_today: {
          total: Number(onLeaveToday[0]?.total || 0),
          employees: onLeaveToday.slice(0, 5).map(mapLeaveRow)
        },
        upcoming_leaves: upcomingLeaves.map(mapLeaveRow),
        pending_leave_requests: pendingLeaveRequests.map((item) => ({
          ...mapLeaveRow(item),
          created_at: item.created_at
        })),
        approved_leave_by_type: leaveByType.map((item) => ({
          leave_type_id: item.id,
          leave_type: item.name,
          color: item.color,
          total_requests: Number(item.total_requests || 0),
          total_days: Number(item.total_days || 0)
        }))
      }

      return res.status(HttpStatusCode.Ok).json(api(dashboardData, HttpStatusCode.Ok, { req }))
    } catch (err) {
      return next(err)
    }
  }
}

module.exports = Controller
