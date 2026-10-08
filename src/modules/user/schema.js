const { z } = require('zod')

const roles = ['ADMIN', 'HR', 'EMPLOYEE']

const createUserSchema = z.object({
	email: z
		.string({ required_error: 'Email is required' })
		.trim()
		.min(1, 'Email is required')
		.email('Invalid email format'),
	password: z
		.string({ required_error: 'Password is required' })
		.min(8, 'Password must be at least 8 characters'),
	role: z.enum(roles).default('EMPLOYEE'),
	status: z.boolean().default(true)
})

const updateUserSchema = z
	.object({
		email: z.string().trim().min(1, 'Email is required').email('Invalid email format').optional(),
		password: z.string().min(8, 'Password must be at least 8 characters').optional(),
		role: z.enum(roles).optional(),
		status: z.boolean().optional()
	})
	.refine((payload) => Object.keys(payload).length > 0, {
		message: 'At least one field must be provided'
	})

const updateUserStatusSchema = z.object({
	status: z.boolean()
})

module.exports = {
	createUserSchema,
	updateUserSchema,
	updateUserStatusSchema
}
