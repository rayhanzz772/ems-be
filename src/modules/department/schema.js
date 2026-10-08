const { z } = require('zod')

const createDepartmentSchema = z.object({
	name: z.string().trim().min(1, 'Department name is required').max(255),
	description: z.string().trim().max(255).optional().or(z.literal(''))
})

const updateDepartmentSchema = z
	.object({
		name: z.string().trim().min(1, 'Department name is required').max(255).optional(),
		description: z.string().trim().max(255).optional().or(z.literal(''))
	})
	.refine((payload) => Object.keys(payload).length > 0, {
		message: 'At least one field must be provided'
	})

module.exports = {
	createDepartmentSchema,
	updateDepartmentSchema
}
