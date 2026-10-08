const Controller = require('./controller')
const router = require('express').Router()
const authMiddleware = require('../../middleware/authMiddleware')

router.post('/login', Controller.login)
router.post('/logout', Controller.logout)
router.get('/get-me', authMiddleware, Controller.getMe)

module.exports = router
