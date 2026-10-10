const { z } = require('zod')

const employmentTypes = ['PERMANENT', 'CONTRACT', 'INTERN']
const employmentStatuses = ['ACTIVE', 'ON_LEAVE', 'RESIGNED', 'TERMINATED']
const normalizeDateOnly = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }
  return value
}

const normalizeDateTime = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString()
  }
  return value
}

const dateOnlySchema = z.preprocess(normalizeDateOnly, z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD format')
  .refine((value) => {
    const parsedDate = new Date(`${value}T00:00:00.000Z`)
    return !Number.isNaN(parsedDate.getTime()) &&
      parsedDate.toISOString().slice(0, 10) === value
  }, { message: 'Invalid date' }))
const hireDateSchema = z.preprocess(
  normalizeDateTime,
  z.string().trim().refine((value) => !Number.isNaN(new Date(value).getTime()), {
    message: 'Invalid hire date'
  })
)

const validateEmploymentDetails = (employee, context) => {
  if (
    employee.employment_type === 'CONTRACT' &&
    (!employee.contract_start_date || !employee.contract_end_date)
  ) {
    context.addIssue({
      code: 'custom',
      path: ['contract_start_date'],
      message: 'Contract start and end dates are required for contract employees'
    })
  }

  if (
    employee.contract_start_date &&
    employee.contract_end_date &&
    employee.contract_start_date > employee.contract_end_date
  ) {
    context.addIssue({
      code: 'custom',
      path: ['contract_end_date'],
      message: 'Contract end date must be on or after the start date'
    })
  }
}

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
  position_id: z.string().trim().min(1, 'Position is required'),
  manager_id: z.string().trim().min(1, 'Manager is invalid').nullable().default(null),
  branch_id: z.string().trim().min(1, 'Branch is invalid').nullable().optional(),
  employment_type: z.enum(employmentTypes).default('PERMANENT'),
  employment_status: z.enum(employmentStatuses).default('ACTIVE'),
  contract_start_date: dateOnlySchema.nullable().optional(),
  contract_end_date: dateOnlySchema.nullable().optional(),
  status: z.boolean().default(true),
  hire_date: hireDateSchema,
  address: z.string().trim().max(255).optional().or(z.literal(''))
}).superRefine(validateEmploymentDetails)

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
  position_id: z.string().trim().min(1, 'Position is required').optional(),
  manager_id: z.string().trim().min(1, 'Manager is invalid').nullable().optional(),
  branch_id: z.string().trim().min(1, 'Branch is invalid').nullable().optional(),
  employment_type: z.enum(employmentTypes).optional(),
  employment_status: z.enum(employmentStatuses).optional(),
  contract_start_date: dateOnlySchema.nullable().optional(),
  contract_end_date: dateOnlySchema.nullable().optional(),
  status: z.boolean().default(true).optional(),
  hire_date: hireDateSchema.optional(),
  address: z.string().trim().max(255).optional().or(z.literal(''))
})
  .superRefine(validateEmploymentDetails)

module.exports = {
  createEmployeeSchema,
  updateEmployeeSchema
}