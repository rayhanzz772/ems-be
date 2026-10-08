const { z } = require('zod')

const createEmployeeSchema = z.object({
  employee_code: z.string().trim().min(1, 'Employee code is required').max(50),
  first_name: z.string().trim().min(1, 'First name is required').max(100),
  last_name: z.string().trim().min(1, 'Last name is required').max(100),
  email: z
    .string({ required_error: 'Email is required', invalid_type_error: 'Email is required' })
    .trim()
    .min(1, 'Email is required')
    .email('Invalid email format'),
  phone_number: z
    .string({ required_error: 'Phone number is required', invalid_type_error: 'Phone number is required' })
    .trim()
    .min(1, 'Phone number is required')
    .regex(/^[0-9+()\-\s]{8,20}$/, 'Invalid phone number'),
  department_id: z.string().trim().min(1, 'Department is required'),
  position: z.string().trim().min(1, 'Position is required').max(100),
  status: z.boolean().default(true),
  hire_date: z
    .string()
    .trim()
    .refine((value) => !Number.isNaN(new Date(value).getTime()), {
      message: 'Invalid hire date'
    }),
  address: z.string().trim().max(255).optional().or(z.literal(''))
})

const updateEmployeeSchema = z.object({
  employee_code: z.string().trim().min(1, 'Employee code is required').max(50).optional(),
  first_name: z.string().trim().min(1, 'First name is required').max(100).optional(),
  last_name: z.string().trim().min(1, 'Last name is required').max(100).optional(),
  email: z
    .string({ required_error: 'Email is required', invalid_type_error: 'Email is required' })
    .trim()
    .min(1, 'Email is required')
    .email('Invalid email format')
    .optional(),
  phone_number: z
    .string({ required_error: 'Phone number is required', invalid_type_error: 'Phone number is required' })
    .trim()
    .min(1, 'Phone number is required')
    .regex(/^[0-9+()\-\s]{8,20}$/, 'Invalid phone number')
    .optional(),
  department_id: z.string().trim().min(1, 'Department is required').optional(),
  position: z.string().trim().min(1, 'Position is required').max(100).optional(),
  status: z.boolean().default(true).optional(),
  hire_date: z
    .string()
    .trim()
    .refine((value) => !Number.isNaN(new Date(value).getTime()), {
      message: 'Invalid hire date'
    })
    .optional(),
  address: z.string().trim().max(255).optional().or(z.literal(''))
})

module.exports = {
  createEmployeeSchema,
  updateEmployeeSchema
}