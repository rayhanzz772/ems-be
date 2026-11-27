const router = require('express').Router()
const Controller = require('./controller')
const authMiddleware = require('../../middleware/authMiddleware')
const limiter = require('../../utils/limiter')

router.use(limiter)
router.use(authMiddleware)

router.get('/', Controller.getNotifications)
router.patch('/read-all', Controller.markAllRead)
router.patch('/:id/read', Controller.markRead)

module.exports = router
