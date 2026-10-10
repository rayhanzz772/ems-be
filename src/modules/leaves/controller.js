'use strict'

const cuid = require('cuid')
const { Op, Transaction } = require('sequelize')
const { HttpStatusCode } = require('axios')
const db = require('../../../db/models')
const { api } = require('../../utils/api')
const { validateRequest } = require('../../utils/validation')
const { createAuditLog } = require('../../utils/auditLog')
const {
  createLeaveTypeSchema,
  updateLeaveTypeSchema,
  createLeaveRequestSchema,
  updateLeaveRequestSchema,
  decideLeaveRequestSchema,
  createLeaveBalanceSchema,
  updateLeaveBalanceSchema,
  dateSchema
} = require('./schema')

const LeaveType = db.LeaveType
const LeaveRequest = db.LeaveRequest
const LeaveBalance = db.LeaveBalance

const parsePage = (value, fallback, maximum = Number.MAX_SAFE_INTEGER) => {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback
}

const leaveIncludes = [
  { model: db.Employee, as: 'employee', attributes: ['id', 'employee_code', 'first_name', 'last_name'] },
  { model: LeaveType, as: 'leave_type', attributes: ['id', 'name', 'color', 'requires_balance'] },
  { model: db.Employee, as: 'approver', attributes: ['id', 'employee_code', 'first_name', 'last_name'], required: false }
]

const balanceIncludes = [
  { model: db.Employee, as: 'employee', attributes: ['id', 'employee_code', 'first_name', 'last_name'] },
  { model: LeaveType, as: 'leave_type', attributes: ['id', 'name', 'color', 'requires_balance'] }
]

const assertEmployee = async (employeeId) => {
  const employee = await db.Employee.findByPk(employeeId)
  if (!employee || !employee.status || employee.employment_status !== 'ACTIVE') {
    throw { code: HttpStatusCode.BadRequest, message: 'Employee does not exist or is inactive' }
  }
  return employee
}

const assertLeaveType = async (leaveTypeId) => {
  const leaveType = await LeaveType.findByPk(leaveTypeId)
  if (!leaveType || !leaveType.is_active) {
    throw { code: HttpStatusCode.BadRequest, message: 'Leave type does not exist or is inactive' }
  }
  return leaveType
}

const assertNoOverlappingRequest = async ({ employeeId, startDate, endDate, excludeId }) => {
  const where = {
    employee_id: employeeId,
    status: { [Op.in]: ['PENDING', 'APPROVED'] },
    start_date: { [Op.lte]: endDate },
    end_date: { [Op.gte]: startDate }
  }
  if (excludeId) where.id = { [Op.ne]: excludeId }

  const existingRequest = await LeaveRequest.findOne({ where, attributes: ['id'] })
  if (existingRequest) {
    throw {
      code: HttpStatusCode.Conflict,
      message: 'Employee already has a pending or approved leave request for these dates'
    }
  }
}

const validateListQuery = (query, allowedStatuses = []) => {
  if (query.status !== undefined && !allowedStatuses.includes(query.status)) {
    throw { code: HttpStatusCode.BadRequest, message: 'Invalid status query parameter' }
  }
  for (const field of ['start_date', 'end_date']) {
    if (query[field] !== undefined && !dateSchema.safeParse(query[field]).success) {
      throw { code: HttpStatusCode.BadRequest, message: `${field} must be a valid date (YYYY-MM-DD)` }
    }
  }
  if (
    query.start_date &&
    query.end_date &&
    query.start_date > query.end_date
  ) {
    throw { code: HttpStatusCode.BadRequest, message: 'start_date must be on or before end_date' }
  }
}

class Controller {
  static async getLeaveTypes(req, res, next) {
    try {
      const page = parsePage(req.query.page, 1)
      const perPage = parsePage(req.query.per_page, 10, 100)
      const where = {}
      if (req.query.is_active !== undefined) {
        if (!['true', 'false'].includes(req.query.is_active)) {
          throw { code: HttpStatusCode.BadRequest, message: 'is_active must be true or false' }
        }
        where.is_active = req.query.is_active === 'true'
      }
      if (typeof req.query.q === 'string' && req.query.q.trim()) {
        where.name = { [Op.iLike]: `%${req.query.q.trim()}%` }
      }
      const result = await LeaveType.findAndCountAll({
        where,
        order: [['name', 'ASC']],
        limit: perPage,
        offset: (page - 1) * perPage
      })
      return res.status(HttpStatusCode.Ok).json(api({
        count: result.count,
        rows: result.rows,
        per_page: perPage,
        page
      }, HttpStatusCode.Ok, { req }))
    } catch (err) {
      return next(err)
    }
  }

  static async getLeaveTypeById(req, res, next) {
    try {
      const leaveType = await LeaveType.findByPk(req.params.id, {
        include: [{ model: LeaveBalance, as: 'balances', attributes: ['id', 'employee_id', 'year', 'allocated_days', 'adjustment_days', 'used_days'] }]
      })
      if (!leaveType) throw { code: HttpStatusCode.NotFound, message: 'Leave type not found' }
      return res.status(HttpStatusCode.Ok).json(api(leaveType, HttpStatusCode.Ok))
    } catch (err) {
      return next(err)
    }
  }

  static async createLeaveType(req, res, next) {
    try {
      const payload = validateRequest(createLeaveTypeSchema, { body: req.body })
      const leaveType = await LeaveType.create({ id: cuid(), ...payload })
      await createAuditLog({
        userId: req.user.id,
        action: 'CREATE',
        entity: 'LeaveType',
        entityId: leaveType.id,
        newData: leaveType.toJSON()
      })
      return res.status(HttpStatusCode.Created).json(api(leaveType, HttpStatusCode.Created))
    } catch (err) {
      return next(err)
    }
  }

  static async updateLeaveType(req, res, next) {
    try {
      const leaveType = await LeaveType.findByPk(req.params.id)
      if (!leaveType) throw { code: HttpStatusCode.NotFound, message: 'Leave type not found' }
      const payload = validateRequest(updateLeaveTypeSchema, { body: req.body })
      if (
        payload.requires_balance !== undefined &&
        payload.requires_balance !== leaveType.requires_balance
      ) {
        const [requestCount, balanceCount] = await Promise.all([
          LeaveRequest.count({ where: { leave_type_id: leaveType.id } }),
          LeaveBalance.count({ where: { leave_type_id: leaveType.id } })
        ])
        if (requestCount > 0 || balanceCount > 0) {
          throw {
            code: HttpStatusCode.Conflict,
            message: 'Cannot change balance requirements for a leave type already used by requests or balances'
          }
        }
      }
      const oldData = leaveType.toJSON()
      await leaveType.update(payload)
      await createAuditLog({
        userId: req.user.id,
        action: 'UPDATE',
        entity: 'LeaveType',
        entityId: leaveType.id,
        oldData,
        newData: leaveType.toJSON()
      })
      return res.status(HttpStatusCode.Ok).json(api(leaveType, HttpStatusCode.Ok))
    } catch (err) {
      return next(err)
    }
  }

  static async deleteLeaveType(req, res, next) {
    try {
      const leaveType = await LeaveType.findByPk(req.params.id)
      if (!leaveType) throw { code: HttpStatusCode.NotFound, message: 'Leave type not found' }
      const references = await Promise.all([
        LeaveRequest.count({ where: { leave_type_id: leaveType.id } }),
        LeaveBalance.count({ where: { leave_type_id: leaveType.id } })
      ])
      if (references.some((count) => count > 0)) {
        throw { code: HttpStatusCode.Conflict, message: 'Cannot delete a leave type used by requests or balances' }
      }
      const oldData = leaveType.toJSON()
      await leaveType.destroy()
      await createAuditLog({
        userId: req.user.id,
        action: 'DELETE',
        entity: 'LeaveType',
        entityId: leaveType.id,
        oldData
      })
      return res.status(HttpStatusCode.Ok).json(api({ id: leaveType.id }, HttpStatusCode.Ok))
    } catch (err) {
      return next(err)
    }
  }

  static async getLeaveRequests(req, res, next) {
    try {
      validateListQuery(req.query, ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'])
      const page = parsePage(req.query.page, 1)
      const perPage = parsePage(req.query.per_page, 10, 100)
      const where = {}
      for (const field of ['employee_id', 'leave_type_id', 'approver_id', 'status']) {
        if (req.query[field] !== undefined) where[field] = req.query[field]
      }
      if (req.query.start_date || req.query.end_date) {
        where.start_date = { [Op.lte]: req.query.end_date || '9999-12-31' }
        where.end_date = { [Op.gte]: req.query.start_date || '0001-01-01' }
      }
      const result = await LeaveRequest.findAndCountAll({
        where,
        include: leaveIncludes,
        distinct: true,
        order: [['start_date', 'DESC'], ['created_at', 'DESC']],
        limit: perPage,
        offset: (page - 1) * perPage
      })
      return res.status(HttpStatusCode.Ok).json(api({
        count: result.count,
        rows: result.rows,
        per_page: perPage,
        page
      }, HttpStatusCode.Ok, { req }))
    } catch (err) {
      return next(err)
    }
  }

  static async getLeaveRequestById(req, res, next) {
    try {
      const leaveRequest = await LeaveRequest.findByPk(req.params.id, { include: leaveIncludes })
      if (!leaveRequest) throw { code: HttpStatusCode.NotFound, message: 'Leave request not found' }
      return res.status(HttpStatusCode.Ok).json(api(leaveRequest, HttpStatusCode.Ok))
    } catch (err) {
      return next(err)
    }
  }

  static async createLeaveRequest(req, res, next) {
    try {
      const payload = validateRequest(createLeaveRequestSchema, { body: req.body })
      const [employee, leaveType] = await Promise.all([
        assertEmployee(payload.employee_id),
        assertLeaveType(payload.leave_type_id)
      ])
      const status = 'PENDING'
      
      if (payload.approver_id) await assertEmployee(payload.approver_id)
      await assertNoOverlappingRequest({
        employeeId: employee.id,
        startDate: payload.start_date,
        endDate: payload.end_date
      })
      if (req.user.role === 'ADMIN') {
        status = 'APPROVED'
      }
      const leaveRequest = await LeaveRequest.create({
        id: cuid(),
        ...payload,
        approver_id: payload.approver_id || employee.manager_id || null,
        status: status
      })
      await createAuditLog({
        userId: req.user.id,
        action: 'CREATE',
        entity: 'LeaveRequest',
        entityId: leaveRequest.id,
        newData: leaveRequest.toJSON()
      })
      const result = await LeaveRequest.findByPk(leaveRequest.id, { include: leaveIncludes })
      return res.status(HttpStatusCode.Created).json(api(result, HttpStatusCode.Created))
    } catch (err) {
      return next(err)
    }
  }

  static async updateLeaveRequest(req, res, next) {
    try {
      const leaveRequest = await LeaveRequest.findByPk(req.params.id)
      if (!leaveRequest) throw { code: HttpStatusCode.NotFound, message: 'Leave request not found' }
      if (leaveRequest.status !== 'PENDING') {
        throw { code: HttpStatusCode.Conflict, message: 'Only pending leave requests can be updated' }
      }
      const payload = validateRequest(updateLeaveRequestSchema, { body: req.body })
      const startDate = payload.start_date || leaveRequest.start_date
      const endDate = payload.end_date || leaveRequest.end_date
      if (endDate < startDate) {
        throw { code: HttpStatusCode.BadRequest, message: 'End date must be on or after the start date' }
      }
      if (payload.leave_type_id) await assertLeaveType(payload.leave_type_id)
      if (payload.approver_id) await assertEmployee(payload.approver_id)
      await assertNoOverlappingRequest({
        employeeId: leaveRequest.employee_id,
        startDate,
        endDate,
        excludeId: leaveRequest.id
      })
      const oldData = leaveRequest.toJSON()
      await leaveRequest.update(payload)
      await createAuditLog({
        userId: req.user.id,
        action: 'UPDATE',
        entity: 'LeaveRequest',
        entityId: leaveRequest.id,
        oldData,
        newData: leaveRequest.toJSON()
      })
      const result = await LeaveRequest.findByPk(leaveRequest.id, { include: leaveIncludes })
      return res.status(HttpStatusCode.Ok).json(api(result, HttpStatusCode.Ok))
    } catch (err) {
      return next(err)
    }
  }

  static async deleteLeaveRequest(req, res, next) {
    try {
      const leaveRequest = await LeaveRequest.findByPk(req.params.id)
      if (!leaveRequest) throw { code: HttpStatusCode.NotFound, message: 'Leave request not found' }
      if (leaveRequest.status !== 'PENDING') {
        throw { code: HttpStatusCode.Conflict, message: 'Only pending leave requests can be deleted' }
      }
      const oldData = leaveRequest.toJSON()
      await leaveRequest.destroy()
      await createAuditLog({
        userId: req.user.id,
        action: 'DELETE',
        entity: 'LeaveRequest',
        entityId: leaveRequest.id,
        oldData
      })
      return res.status(HttpStatusCode.Ok).json(api({ id: leaveRequest.id }, HttpStatusCode.Ok))
    } catch (err) {
      return next(err)
    }
  }

  static async decideLeaveRequest(req, res, next) {
    try {
      const payload = validateRequest(decideLeaveRequestSchema, { body: req.body })
      const result = await db.sequelize.transaction(
        { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
        async (transaction) => {
          const leaveRequest = await LeaveRequest.findByPk(req.params.id, {
            include: [{ model: LeaveType, as: 'leave_type' }],
            transaction,
            lock: transaction.LOCK.UPDATE
          })
          if (!leaveRequest) throw { code: HttpStatusCode.NotFound, message: 'Leave request not found' }
          if (leaveRequest.status !== 'PENDING') {
            throw { code: HttpStatusCode.Conflict, message: 'Only pending leave requests can be decided' }
          }

          if (payload.status === 'APPROVED' && leaveRequest.leave_type.requires_balance) {
            if (leaveRequest.start_date.slice(0, 4) !== leaveRequest.end_date.slice(0, 4)) {
              throw { code: HttpStatusCode.BadRequest, message: 'Balance-based leave must be within one calendar year' }
            }
            const balance = await LeaveBalance.findOne({
              where: {
                employee_id: leaveRequest.employee_id,
                leave_type_id: leaveRequest.leave_type_id,
                year: Number(leaveRequest.start_date.slice(0, 4))
              },
              transaction,
              lock: transaction.LOCK.UPDATE
            })
            if (!balance) {
              throw { code: HttpStatusCode.Conflict, message: 'No leave balance exists for this employee, leave type, and year' }
            }
            const availableDays = Number(balance.allocated_days) +
              Number(balance.adjustment_days) -
              Number(balance.used_days)
            if (availableDays < Number(leaveRequest.duration_days)) {
              throw { code: HttpStatusCode.Conflict, message: 'Insufficient leave balance' }
            }
            await balance.increment('used_days', {
              by: Number(leaveRequest.duration_days),
              transaction
            })
            await balance.reload({ transaction })
          }

          const oldData = leaveRequest.toJSON()
          await leaveRequest.update({
            status: payload.status,
            decision_note: payload.decision_note ?? null,
            decided_by: req.user.id,
            decided_at: new Date()
          }, { transaction })
          return { leaveRequest, oldData }
        }
      )
      await createAuditLog({
        userId: req.user.id,
        action: 'UPDATE',
        entity: 'LeaveRequest',
        entityId: result.leaveRequest.id,
        oldData: result.oldData,
        newData: result.leaveRequest.toJSON()
      })
      const updated = await LeaveRequest.findByPk(result.leaveRequest.id, { include: leaveIncludes })
      return res.status(HttpStatusCode.Ok).json(api(updated, HttpStatusCode.Ok))
    } catch (err) {
      return next(err)
    }
  }

  static async cancelLeaveRequest(req, res, next) {
    try {
      const result = await db.sequelize.transaction(async (transaction) => {
        const leaveRequest = await LeaveRequest.findByPk(req.params.id, {
          include: [{ model: LeaveType, as: 'leave_type' }],
          transaction,
          lock: transaction.LOCK.UPDATE
        })
        if (!leaveRequest) throw { code: HttpStatusCode.NotFound, message: 'Leave request not found' }
        if (!['PENDING', 'APPROVED'].includes(leaveRequest.status)) {
          throw { code: HttpStatusCode.Conflict, message: 'Only pending or approved leave requests can be cancelled' }
        }

        const oldData = leaveRequest.toJSON()
        if (leaveRequest.status === 'APPROVED' && leaveRequest.leave_type.requires_balance) {
          const balance = await LeaveBalance.findOne({
            where: {
              employee_id: leaveRequest.employee_id,
              leave_type_id: leaveRequest.leave_type_id,
              year: Number(leaveRequest.start_date.slice(0, 4))
            },
            transaction,
            lock: transaction.LOCK.UPDATE
          })
          if (!balance || Number(balance.used_days) < Number(leaveRequest.duration_days)) {
            throw { code: HttpStatusCode.Conflict, message: 'Leave balance is inconsistent; cancellation was not applied' }
          }
          await balance.decrement('used_days', {
            by: Number(leaveRequest.duration_days),
            transaction
          })
        }

        await leaveRequest.update({
          status: 'CANCELLED',
          decided_by: req.user.id,
          decided_at: new Date()
        }, { transaction })
        return { leaveRequest, oldData }
      })
      await createAuditLog({
        userId: req.user.id,
        action: 'UPDATE',
        entity: 'LeaveRequest',
        entityId: result.leaveRequest.id,
        oldData: result.oldData,
        newData: result.leaveRequest.toJSON()
      })
      const updated = await LeaveRequest.findByPk(result.leaveRequest.id, { include: leaveIncludes })
      return res.status(HttpStatusCode.Ok).json(api(updated, HttpStatusCode.Ok))
    } catch (err) {
      return next(err)
    }
  }

  static async getLeaveCalendar(req, res, next) {
    try {
      if (!req.query.start_date || !req.query.end_date) {
        throw { code: HttpStatusCode.BadRequest, message: 'start_date and end_date are required' }
      }
      validateListQuery(req.query, ['PENDING', 'APPROVED'])
      const where = {
        status: { [Op.in]: ['PENDING', 'APPROVED'] },
        start_date: { [Op.lte]: req.query.end_date },
        end_date: { [Op.gte]: req.query.start_date }
      }
      if (req.query.employee_id) where.employee_id = req.query.employee_id
      if (req.query.leave_type_id) where.leave_type_id = req.query.leave_type_id
      if (req.query.status) where.status = req.query.status
      const rows = await LeaveRequest.findAll({
        where,
        include: leaveIncludes,
        order: [['start_date', 'ASC'], ['employee_id', 'ASC']]
      })
      return res.status(HttpStatusCode.Ok).json(api(rows, HttpStatusCode.Ok))
    } catch (err) {
      return next(err)
    }
  }

  static async getLeaveBalances(req, res, next) {
    try {
      const page = parsePage(req.query.page, 1)
      const perPage = parsePage(req.query.per_page, 10, 100)
      const where = {}
      for (const field of ['employee_id', 'leave_type_id', 'year']) {
        if (req.query[field] !== undefined) where[field] = req.query[field]
      }
      const result = await LeaveBalance.findAndCountAll({
        where,
        include: balanceIncludes,
        order: [['year', 'DESC'], ['employee_id', 'ASC']],
        limit: perPage,
        offset: (page - 1) * perPage
      })
      return res.status(HttpStatusCode.Ok).json(api({
        count: result.count,
        rows: result.rows,
        per_page: perPage,
        page
      }, HttpStatusCode.Ok, { req }))
    } catch (err) {
      return next(err)
    }
  }

  static async getLeaveBalanceById(req, res, next) {
    try {
      const balance = await LeaveBalance.findByPk(req.params.id, { include: balanceIncludes })
      if (!balance) throw { code: HttpStatusCode.NotFound, message: 'Leave balance not found' }
      return res.status(HttpStatusCode.Ok).json(api(balance, HttpStatusCode.Ok))
    } catch (err) {
      return next(err)
    }
  }

  static async createLeaveBalance(req, res, next) {
    try {
      const payload = validateRequest(createLeaveBalanceSchema, { body: req.body })
      await Promise.all([
        assertEmployee(payload.employee_id),
        assertLeaveType(payload.leave_type_id)
      ])
      const balance = await LeaveBalance.create({ id: cuid(), ...payload })
      await createAuditLog({
        userId: req.user.id,
        action: 'CREATE',
        entity: 'LeaveBalance',
        entityId: balance.id,
        newData: balance.toJSON()
      })
      const result = await LeaveBalance.findByPk(balance.id, { include: balanceIncludes })
      return res.status(HttpStatusCode.Created).json(api(result, HttpStatusCode.Created))
    } catch (err) {
      return next(err)
    }
  }

  static async updateLeaveBalance(req, res, next) {
    try {
      const balance = await LeaveBalance.findByPk(req.params.id)
      if (!balance) throw { code: HttpStatusCode.NotFound, message: 'Leave balance not found' }
      const payload = validateRequest(updateLeaveBalanceSchema, { body: req.body })
      const allocatedDays = payload.allocated_days ?? Number(balance.allocated_days)
      const adjustmentDays = payload.adjustment_days ?? Number(balance.adjustment_days)
      if (allocatedDays + adjustmentDays < Number(balance.used_days)) {
        throw {
          code: HttpStatusCode.Conflict,
          message: 'Allocation and adjustment cannot be lower than days already used'
        }
      }
      const oldData = balance.toJSON()
      await balance.update(payload)
      await createAuditLog({
        userId: req.user.id,
        action: 'UPDATE',
        entity: 'LeaveBalance',
        entityId: balance.id,
        oldData,
        newData: balance.toJSON()
      })
      const result = await LeaveBalance.findByPk(balance.id, { include: balanceIncludes })
      return res.status(HttpStatusCode.Ok).json(api(result, HttpStatusCode.Ok))
    } catch (err) {
      return next(err)
    }
  }

  static async deleteLeaveBalance(req, res, next) {
    try {
      const balance = await LeaveBalance.findByPk(req.params.id)
      if (!balance) throw { code: HttpStatusCode.NotFound, message: 'Leave balance not found' }
      if (Number(balance.used_days) > 0) {
        throw { code: HttpStatusCode.Conflict, message: 'Cannot delete a leave balance with used days' }
      }
      const oldData = balance.toJSON()
      await balance.destroy()
      await createAuditLog({
        userId: req.user.id,
        action: 'DELETE',
        entity: 'LeaveBalance',
        entityId: balance.id,
        oldData
      })
      return res.status(HttpStatusCode.Ok).json(api({ id: balance.id }, HttpStatusCode.Ok))
    } catch (err) {
      return next(err)
    }
  }
}

module.exports = Controller
