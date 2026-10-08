const { z } = require('zod')

const auditLogQuerySchema = z
	.object({
		page: z.coerce.number().int().positive().default(1),
		per_page: z.coerce.number().int().positive().max(100).default(10),
		q: z.string().trim().optional(),
		action: z.enum(['CREATE', 'UPDATE', 'DELETE']).optional(),
		entity: z.string().trim().optional(),
		user_id: z.string().trim().optional(),
		date_from: z.string().date().optional(),
		date_to: z.string().date().optional(),
		sort_by: z.enum(['created_at', 'action', 'entity', 'entity_id', 'user_email']).default('created_at'),
		sort_order: z.enum(['ASC', 'DESC']).default('DESC')
	})
	.refine(
		({ date_from, date_to }) => !date_from || !date_to || date_from <= date_to,
		{ message: 'date_from must be before or equal to date_to' }
	)

module.exports = {
	auditLogQuerySchema
}
