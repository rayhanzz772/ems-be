const { z } = require('zod')

const createPositionSchema = z.object({
  name: z.string().trim().min(1, 'Position name is required').max(255),
  description: z.string().trim().min(1, 'Position description is required').max(255)
})

const updatePositionSchema = z
  .object({
    name: z.string().trim().min(1, 'Position name is required').max(255).optional(),
    description: z.string().trim().min(1, 'Position description is required').max(255).optional()
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'At least one field must be provided'
  })

module.exports = {
  createPositionSchema,
  updatePositionSchema
}
