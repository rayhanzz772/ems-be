const Controller = require('./controller')
const router = require('express').Router()
const authMiddleware = require('../../middleware/authMiddleware')
const adminOnly = require('../../middleware/roleMiddleware')
const limiter = require('../../utils/limiter')

router.use(limiter)
router.use(authMiddleware)
router.get('/', Controller.getEmployees)
router.get('/export', Controller.exportEmployeesCsv)
router.get('/:id/detail', Controller.getEmployeeById)
router.post('/create', adminOnly, Controller.createEmployee)
router.put('/:id/update', adminOnly, Controller.updateEmployee)
router.delete('/:id/delete', adminOnly, Controller.deleteEmployee)

module.exports = router