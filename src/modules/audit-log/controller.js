const ExcelJS = require('exceljs')
const { api } = require('../../../src/utils/api')
const db = require('../../../db/models')
const { HttpStatusCode } = require('axios')
const { auditLogQuerySchema } = require('./schema')
const { auditLogCsv } = require('../../utils/excel')

const parseQuery = (query) => {
	const result = auditLogQuerySchema.safeParse(query)

	if (!result.success) {
		throw {
			statusCode: HttpStatusCode.BadRequest,
			message: result.error.issues[0]?.message || 'Invalid audit log query'
		}
	}

	return result.data
}

const buildAuditLogQuery = (filters, paginate = false) => {
	const conditions = []
	const replacements = {}

	if (filters.q) {
		conditions.push(`(
			LOWER(a.entity) LIKE LOWER(:search) OR
			LOWER(a.entity_id) LIKE LOWER(:search) OR
			LOWER(u.email) LIKE LOWER(:search)
		)`)
		replacements.search = `%${filters.q}%`
	}

	if (filters.action) {
		conditions.push('a.action = :action')
		replacements.action = filters.action
	}

	if (filters.entity) {
		conditions.push('LOWER(a.entity) LIKE LOWER(:entity)')
		replacements.entity = `%${filters.entity}%`
	}

	if (filters.user_id) {
		conditions.push('a.user_id = :userId')
		replacements.userId = filters.user_id
	}

	if (filters.date_from) {
		conditions.push('a.created_at >= :dateFrom')
		replacements.dateFrom = filters.date_from
	}

	if (filters.date_to) {
		conditions.push('DATE(a.created_at) <= :dateTo')
		replacements.dateTo = filters.date_to
	}

	const sortColumns = {
		created_at: 'a.created_at',
		action: 'a.action',
		entity: 'a.entity',
		entity_id: 'a.entity_id',
		user_email: 'u.email'
	}
	const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
	const orderClause = `ORDER BY ${sortColumns[filters.sort_by]} ${filters.sort_order}`
	const paginationClause = paginate ? 'LIMIT :limit OFFSET :offset' : ''

	if (paginate) {
		replacements.limit = filters.per_page
		replacements.offset = (filters.page - 1) * filters.per_page
	}

	return { whereClause, orderClause, paginationClause, replacements }
}

const selectAuditLogs = (query, paginate = false) => {
	const { whereClause, orderClause, paginationClause, replacements } =
		buildAuditLogQuery(query, paginate)

	return db.sequelize.query(
		`
		SELECT
			a.id,
			a.user_id,
			u.email AS user_email,
			a.action,
			a.entity,
			a.entity_id,
			a.old_data,
			a.new_data,
			a.created_at
		FROM audit_logs a
		LEFT JOIN users u ON u.id = a.user_id
		${whereClause}
		${orderClause}
		${paginationClause}
		`,
		{
			type: db.Sequelize.QueryTypes.SELECT,
			replacements
		}
	)
}

class Controller {
	static async getAuditLogs(req, res, next) {
		try {
			const filters = parseQuery(req.query)
			const rows = await selectAuditLogs(filters, true)
			const countResult = await db.sequelize.query(
				`
				SELECT COUNT(*) AS total
				FROM audit_logs a
				LEFT JOIN users u ON u.id = a.user_id
				${buildAuditLogQuery(filters).whereClause}
				`,
				{
					type: db.Sequelize.QueryTypes.SELECT,
					replacements: buildAuditLogQuery(filters).replacements
				}
			)

			return res.status(HttpStatusCode.Ok).json(
				api(
					{ count: Number(countResult[0].total), rows },
					HttpStatusCode.Ok,
					{ req }
				)
			)
		} catch (err) {
			return next(err)
		}
	}

	static async exportAuditLogs(req, res, next) {
		try {
			const filters = parseQuery(req.query)
			const rows = await selectAuditLogs(filters)
			const csv = await auditLogCsv(rows)
			const date = new Date().toISOString().slice(0, 10)

			res.setHeader('Content-Type', 'text/csv; charset=utf-8')
			res.setHeader(
				'Content-Disposition',
				`attachment; filename="audit-logs-${date}.csv"`
			)

			return res.status(HttpStatusCode.Ok).send(csv)
		} catch (err) {
			return next(err)
		}
	}
}

module.exports = Controller
