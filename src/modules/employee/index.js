const Controller = require('./controller')
const router = require('express').Router()
const authMiddleware = require('../../middleware/authMiddleware')
const limiter = require('../../utils/limiter')

router.use(limiter)
router.use(authMiddleware)
router.get('/', Controller.getEmployees)
router.get('/:id/detail', Controller.getEmployeeById)
router.post('/create', Controller.createEmployee)
router.put('/:id/update', Controller.updateEmployee)
router.delete('/:id/delete', Controller.deleteEmployee)

module.exports = router