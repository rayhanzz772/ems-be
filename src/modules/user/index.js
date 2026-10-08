const Controller = require('./controller')
const router = require('express').Router()
const authMiddleware = require('../../middleware/authMiddleware')
const adminOnly = require('../../middleware/roleMiddleware')
const limiter = require('../../utils/limiter')

router.use(limiter)
router.use(authMiddleware)
router.use(adminOnly)
router.get('/', Controller.getUser)
router.get('/:id/detail', Controller.getUserById)
router.post('/create', Controller.createUser)
router.put('/:id/update', Controller.updateUser)
router.delete('/:id/delete', Controller.deleteUser)
router.patch('/:id/status', adminOnly, Controller.updateUserStatus)

module.exports = router