const Controller = require('./controller')
const router = require('express').Router()
const authMiddleware = require('../../middleware/authMiddleware')
const requirePermission = require('../../middleware/permissionMiddleware')
const limiter = require('../../utils/limiter')

router.use(limiter)
router.use(authMiddleware)
router.get('/', requirePermission('role.read'), Controller.getPermissions)

module.exports = router
