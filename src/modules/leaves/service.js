'use strict'

const { HttpStatusCode } = require('axios')
const db = require('../../../db/models')
const { notify } = require('../notification/service')

const LEVELS = {
  LEVEL_1: 'LEVEL_1',
  LEVEL_2: 'LEVEL_2'
}

const DECIDE_PERMISSION = 'leave_request.decide'
const DIRECT_REPORT_PERMISSION = 'leave_request.decide_direct_report'
const MS_PER_DAY = 24 * 60 * 60 * 1000

const toUtcDate = (value) => new Date(`${value}T00:00:00.000Z`)
const isoWeekday = (date) => {
  const day = date.getUTCDay()
  return day === 0 ? 7 : day
}

/**
 * Menghitung hari kerja dalam rentang tanggal. Murni supaya bisa diuji tanpa DB.
 * `workDays` memakai nomor ISO: 1 = Senin ... 7 = Minggu.
 * `holidays` berisi tanggal YYYY-MM-DD dan baru akan terisi di Fase 3.
 */
const countWorkDays = (startDate, endDate, { workDays = [1, 2, 3, 4, 5], holidays = [] } = {}) => {
  const start = toUtcDate(startDate)
  const end = toUtcDate(endDate)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0

  const holidaySet = new Set(holidays)
  let days = 0
  for (let cursor = start; cursor <= end; cursor = new Date(cursor.getTime() + MS_PER_DAY)) {
    const key = cursor.toISOString().slice(0, 10)
    if (!workDays.includes(isoWeekday(cursor)) || holidaySet.has(key)) continue
    days += 1
  }
  return days
}

/**
 * Menentukan tingkat pertama. Atasan yang tidak aktif atau orang yang sama
 * dengan pemohon tidak boleh menjadi approver. Murni, tanpa DB.
 */
const resolveApprovalChain = ({ employee, manager }) => {
  const usableManager = manager &&
    manager.id !== employee.id &&
    Boolean(manager.status) &&
    manager.employment_status === 'ACTIVE'

  if (usableManager) {
    return { currentLevel: LEVELS.LEVEL_1, level1EmployeeId: manager.id }
  }
  return { currentLevel: LEVELS.LEVEL_2, level1EmployeeId: null }
}

/**
 * Aturan siapa yang boleh memutuskan di tingkat mana. Murni, tanpa DB.
 * Permission saja tidak cukup: LEVEL_1 juga butuh kecocokan baris.
 */
const authorizeDecision = ({ level, callerEmployeeId, callerPermissions = [], leaveRequest }) => {
  if (callerEmployeeId && callerEmployeeId === leaveRequest.employee_id) {
    return {
      allowed: false,
      code: HttpStatusCode.Forbidden,
      message: 'A leave request cannot be decided by its own requester'
    }
  }

  const currentLevel = level || LEVELS.LEVEL_2

  if (currentLevel === LEVELS.LEVEL_1) {
    if (!callerPermissions.includes(DIRECT_REPORT_PERMISSION)) {
      return {
        allowed: false,
        code: HttpStatusCode.Forbidden,
        message: `Permission required: ${DIRECT_REPORT_PERMISSION}`
      }
    }
    if (!callerEmployeeId || callerEmployeeId !== leaveRequest.level_1_employee_id) {
      return {
        allowed: false,
        code: HttpStatusCode.Forbidden,
        message: 'Only the assigned direct manager can decide this level'
      }
    }
    return { allowed: true }
  }

  if (!callerPermissions.includes(DECIDE_PERMISSION)) {
    return {
      allowed: false,
      code: HttpStatusCode.Forbidden,
      message: `Permission required: ${DECIDE_PERMISSION}`
    }
  }

  return { allowed: true }
}

/**
 * Satu-satunya tempat saldo dipotong. Dipanggil hanya saat LEVEL_2 disetujui
 * sehingga satu permohonan tidak mungkin memotong saldo dua kali.
 */
const applyBalanceOnFinalApproval = async ({ leaveRequest, leaveType, transaction }) => {
  if (!leaveType.requires_balance) return

  const year = Number(leaveRequest.start_date.slice(0, 4))
  if (leaveRequest.start_date.slice(0, 4) !== leaveRequest.end_date.slice(0, 4)) {
    throw { code: HttpStatusCode.BadRequest, message: 'Balance-based leave must be within one calendar year' }
  }

  const balance = await db.LeaveBalance.findOne({
    where: {
      employee_id: leaveRequest.employee_id,
      leave_type_id: leaveRequest.leave_type_id,
      year
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
}

const findDecideUserIds = async (transaction) => {
  const users = await db.User.findAll({
    where: { status: true },
    attributes: ['id'],
    include: [{
      model: db.Role,
      as: 'role',
      attributes: ['id'],
      required: true,
      where: { status: true },
      include: [{
        model: db.Permission,
        as: 'permissions',
        attributes: ['id'],
        required: true,
        where: { key: DECIDE_PERMISSION }
      }]
    }],
    transaction
  })
  return users.map((user) => user.id)
}

const notifyCurrentApprover = async ({ leaveRequest, title, body, transaction }) => {
  const notifications = []

  if (leaveRequest.current_level === LEVELS.LEVEL_1 && leaveRequest.level_1_employee_id) {
    const user = await db.User.findOne({
      where: { employee_id: leaveRequest.level_1_employee_id, status: true },
      attributes: ['id'],
      transaction
    })
    if (user) notifications.push(user.id)
  } else {
    notifications.push(...await findDecideUserIds(transaction))
  }

  for (const userId of notifications) {
    await notify({
      userId,
      type: 'LEAVE_APPROVAL_NEEDED',
      title,
      body,
      entityType: 'LeaveRequest',
      entityId: leaveRequest.id,
      transaction
    })
  }
}

const notifyApplicant = async ({ leaveRequest, title, body, transaction }) => {
  const user = await db.User.findOne({
    where: { employee_id: leaveRequest.employee_id, status: true },
    attributes: ['id'],
    transaction
  })
  if (!user) return

  await notify({
    userId: user.id,
    type: 'LEAVE_DECISION',
    title,
    body,
    entityType: 'LeaveRequest',
    entityId: leaveRequest.id,
    transaction
  })
}

module.exports = {
  LEVELS,
  DECIDE_PERMISSION,
  DIRECT_REPORT_PERMISSION,
  countWorkDays,
  resolveApprovalChain,
  authorizeDecision,
  applyBalanceOnFinalApproval,
  findDecideUserIds,
  notifyCurrentApprover,
  notifyApplicant
}
