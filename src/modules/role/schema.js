const { z } = require('zod')

const createRoleSchema = z.object({
  name: z.string().trim().min(1, 'Role name is required').max(255),
  description: z.string().trim().max(255).optional().or(z.literal('')),
  status: z.boolean().default(true)
})

const updateRoleSchema = z
  .object({
    name: z.string().trim().min(1, 'Role name is required').max(255).optional(),
    description: z.string().trim().max(255).optional().or(z.literal('')),
    status: z.boolean().optional()
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'At least one field must be provided'
  })

module.exports = {
  createRoleSchema,
  updateRoleSchema
}
