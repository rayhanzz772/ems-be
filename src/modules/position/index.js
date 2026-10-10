const Controller = require('./controller')
const router = require('express').Router()
const authMiddleware = require('../../middleware/authMiddleware')
const requirePermission = require('../../middleware/permissionMiddleware')
const limiter = require('../../utils/limiter')

router.use(limiter)
router.use(authMiddleware)
router.get('/', requirePermission('position.read'), Controller.getPositions)
router.get('/:id/detail', requirePermission('position.read'), Controller.getPositionById)
router.post('/create', requirePermission('position.create'), Controller.createPosition)
router.put('/:id/update', requirePermission('position.update'), Controller.updatePosition)
router.delete('/:id/delete', requirePermission('position.delete'), Controller.deletePosition)

module.exports = router
