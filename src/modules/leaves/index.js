'use strict'

const Controller = require('./controller')
const router = require('express').Router()
const authMiddleware = require('../../middleware/authMiddleware')
const requirePermission = require('../../middleware/permissionMiddleware')
const limiter = require('../../utils/limiter')

router.use(limiter)
router.use(authMiddleware)

router.get('/calendar', requirePermission('leave_request.read'), Controller.getLeaveCalendar)

router.get('/types', requirePermission('leave_type.read'), Controller.getLeaveTypes)
router.get('/types/:id/detail', requirePermission('leave_type.read'), Controller.getLeaveTypeById)
router.post('/types/create', requirePermission('leave_type.create'), Controller.createLeaveType)
router.put('/types/:id/update', requirePermission('leave_type.update'), Controller.updateLeaveType)
router.delete('/types/:id/delete', requirePermission('leave_type.delete'), Controller.deleteLeaveType)

router.get('/requests', requirePermission('leave_request.read'), Controller.getLeaveRequests)
router.get('/requests/:id/detail', requirePermission('leave_request.read'), Controller.getLeaveRequestById)
router.post('/requests/create', requirePermission('leave_request.create'), Controller.createLeaveRequest)
router.put('/requests/:id/update', requirePermission('leave_request.update'), Controller.updateLeaveRequest)
router.delete('/requests/:id/delete', requirePermission('leave_request.delete'), Controller.deleteLeaveRequest)
router.patch('/requests/:id/decision', requirePermission('leave_request.decide'), Controller.decideLeaveRequest)
router.patch('/requests/:id/cancel', requirePermission('leave_request.update'), Controller.cancelLeaveRequest)

router.get('/balances', requirePermission('leave_balance.read'), Controller.getLeaveBalances)
router.get('/balances/:id/detail', requirePermission('leave_balance.read'), Controller.getLeaveBalanceById)
router.post('/balances/create', requirePermission('leave_balance.create'), Controller.createLeaveBalance)
router.put('/balances/:id/update', requirePermission('leave_balance.update'), Controller.updateLeaveBalance)
router.delete('/balances/:id/delete', requirePermission('leave_balance.delete'), Controller.deleteLeaveBalance)

module.exports = router
