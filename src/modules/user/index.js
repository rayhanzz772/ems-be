const Controller = require('./controller')
const router = require('express').Router()
const authMiddleware = require('../../middleware/authMiddleware')
const requirePermission = require('../../middleware/permissionMiddleware')
const limiter = require('../../utils/limiter')

router.use(limiter)
router.use(authMiddleware)
router.get('/', requirePermission('user.read'), Controller.getUser)
router.get('/:id/detail', requirePermission('user.read'), Controller.getUserById)
router.post('/create', requirePermission('user.create'), Controller.createUser)
router.put('/:id/update', requirePermission('user.update'), Controller.updateUser)
router.delete('/:id/delete', requirePermission('user.delete'), Controller.deleteUser)
router.patch('/:id/status', requirePermission('user.update'), Controller.updateUserStatus)
router.get('/get-all-roles', requirePermission('role.read'), Controller.getAllRoles)

module.exports = router