const Controller = require('./controller')
const router = require('express').Router()
const authMiddleware = require('../../middleware/authMiddleware')
const adminOnly = require('../../middleware/roleMiddleware')
const limiter = require('../../utils/limiter')

router.use(limiter)
router.use(authMiddleware)
router.use(adminOnly)
router.get('/', Controller.getRoles)
router.get('/:id/detail', Controller.getRoleById)
router.post('/create', Controller.createRole)
router.put('/:id/update', Controller.updateRole)
router.delete('/:id/delete', Controller.deleteRole)
router.patch('/:id/status', Controller.toggleRoleStatus)

module.exports = router
