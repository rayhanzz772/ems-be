'use strict'

const { z } = require('zod')

const isDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

const dateSchema = z.string().refine(isDate, 'Must be a valid date (YYYY-MM-DD)')
const optionalNullableText = (max) => z.string().trim().max(max).nullable().optional()
const nonNegativeNumber = z.number().finite().min(0)
const positiveNumber = z.number().finite().gt(0).max(999.99)

const createLeaveTypeSchema = z.object({
  name: z.string().trim().min(1, 'Leave type name is required').max(255),
  description: optionalNullableText(5000),
  annual_quota: nonNegativeNumber.nullable().optional(),
  requires_balance: z.boolean().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a hex color').optional(),
  is_active: z.boolean().optional()
})

const updateLeaveTypeSchema = createLeaveTypeSchema.partial().refine(
  (payload) => Object.keys(payload).length > 0,
  { message: 'At least one field must be provided' }
)

const createLeaveRequestSchema = z.object({
  employee_id: z.string().trim().min(1),
  leave_type_id: z.string().trim().min(1),
  approver_id: z.string().trim().min(1).nullable().optional(),
  start_date: dateSchema,
  end_date: dateSchema,
  duration_days: positiveNumber,
  reason: z.string().trim().min(1).max(5000)
}).refine((payload) => payload.end_date >= payload.start_date, {
  path: ['end_date'],
  message: 'End date must be on or after the start date'
})

const updateLeaveRequestSchema = z.object({
  leave_type_id: z.string().trim().min(1).optional(),
  approver_id: z.string().trim().min(1).nullable().optional(),
  start_date: dateSchema.optional(),
  end_date: dateSchema.optional(),
  duration_days: positiveNumber.optional(),
  reason: z.string().trim().min(1).max(5000).optional()
}).refine((payload) => Object.keys(payload).length > 0, {
  message: 'At least one field must be provided'
})

const decideLeaveRequestSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  decision_note: optionalNullableText(5000)
})

const createLeaveBalanceSchema = z.object({
  employee_id: z.string().trim().min(1),
  leave_type_id: z.string().trim().min(1),
  year: z.number().int().min(2000).max(9999),
  allocated_days: nonNegativeNumber,
  adjustment_days: z.number().finite().optional()
})

const updateLeaveBalanceSchema = z.object({
  allocated_days: nonNegativeNumber.optional(),
  adjustment_days: z.number().finite().optional()
}).refine((payload) => Object.keys(payload).length > 0, {
  message: 'At least one field must be provided'
})

module.exports = {
  createLeaveTypeSchema,
  updateLeaveTypeSchema,
  createLeaveRequestSchema,
  updateLeaveRequestSchema,
  decideLeaveRequestSchema,
  createLeaveBalanceSchema,
  updateLeaveBalanceSchema,
  dateSchema
}
