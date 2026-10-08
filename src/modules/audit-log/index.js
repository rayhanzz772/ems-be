const Controller = require('./controller')
const router = require('express').Router()
const authMiddleware = require('../../middleware/authMiddleware')
const adminOnly = require('../../middleware/roleMiddleware')
const limiter = require('../../utils/limiter')

router.use(limiter)
router.use(authMiddleware)
router.use(adminOnly)
router.get('/export', Controller.exportAuditLogs)
router.get('/', Controller.getAuditLogs)

module.exports = router
