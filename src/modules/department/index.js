const Controller = require('./controller')
const router = require('express').Router()
const authMiddleware = require('../../middleware/authMiddleware')
const requirePermission = require('../../middleware/permissionMiddleware')
const limiter = require('../../utils/limiter')

router.use(limiter)
router.use(authMiddleware)
router.get('/', requirePermission('department.read'), Controller.getDepartments)
router.get('/:id/detail', requirePermission('department.read'), Controller.getDepartmentById)
router.post('/create', requirePermission('department.create'), Controller.createDepartment)
router.put('/:id/update', requirePermission('department.update'), Controller.updateDepartment)
router.delete('/:id/delete', requirePermission('department.delete'), Controller.deleteDepartment)
router.patch('/:id/status', requirePermission('department.update'), Controller.toggleDepartmentStatus)

module.exports = router
