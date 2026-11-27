const router = require('express').Router()
const Controller = require('./controller')
const authMiddleware = require('../../middleware/authMiddleware')

router.post('/login', Controller.login)
router.post('/refresh', Controller.refresh)
router.post('/logout', Controller.logout)
router.get('/get-me', authMiddleware, Controller.getMe)
router.get('/sessions', authMiddleware, Controller.getSessions)
router.delete('/sessions/:id/revoke', authMiddleware, Controller.revokeSession)

module.exports = router
