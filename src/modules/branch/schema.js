const { z } = require('zod')

const createBranchSchema = z.object({
  name: z.string().trim().min(1, 'Branch name is required').max(255),
  address: z.string().trim().max(255).nullable().optional()
})

const updateBranchSchema = z
  .object({
    name: z.string().trim().min(1, 'Branch name is required').max(255).optional(),
    address: z.string().trim().max(255).nullable().optional(),
    status: z.boolean().optional()
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'At least one field must be provided'
  })

module.exports = {
  createBranchSchema,
  updateBranchSchema
}