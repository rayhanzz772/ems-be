const Controller = require('./controller')
const router = require('express').Router()
const authMiddleware = require('../../middleware/authMiddleware')
const requirePermission = require('../../middleware/permissionMiddleware')
const limiter = require('../../utils/limiter')

router.use(limiter)
router.use(authMiddleware)
router.get('/', requirePermission('employee.read'), Controller.getEmployees)
router.get('/export', requirePermission('employee.export'), Controller.exportEmployeesCsv)
router.get('/:id/detail', requirePermission('employee.read'), Controller.getEmployeeById)
router.post('/create', requirePermission('employee.create'), Controller.createEmployee)
router.put('/:id/update', requirePermission('employee.update'), Controller.updateEmployee)
router.delete('/:id/delete', requirePermission('employee.delete'), Controller.deleteEmployee)
router.patch('/:id/status', requirePermission('employee.update'), Controller.toggleEmployeeStatus)
router.get('/get-all-departments', requirePermission('department.read'), Controller.getAllDepartments)

module.exports = router