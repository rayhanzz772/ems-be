const Controller = require('./controller')
const router = require('express').Router()
const authMiddleware = require('../../middleware/authMiddleware')
const requirePermission = require('../../middleware/permissionMiddleware')
const limiter = require('../../utils/limiter')

router.use(limiter)
router.use(authMiddleware)
router.get('/', requirePermission('role.read'), Controller.getRoles)
router.get('/:id/detail', requirePermission('role.read'), Controller.getRoleById)
router.get('/:id/permissions', requirePermission('role.read'), Controller.getRolePermissions)
router.post('/create', requirePermission('role.create'), Controller.createRole)
router.put('/:id/update', requirePermission('role.update'), Controller.updateRole)
router.put('/:id/permissions', requirePermission('role.permission.assign'), Controller.updateRolePermissions)
router.delete('/:id/delete', requirePermission('role.delete'), Controller.deleteRole)
router.patch('/:id/status', requirePermission('role.update'), Controller.toggleRoleStatus)

module.exports = router
