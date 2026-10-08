const Controller = require('./controller')
const router = require('express').Router()
const authMiddleware = require('../../middleware/authMiddleware')
const adminOnly = require('../../middleware/roleMiddleware')
const limiter = require('../../utils/limiter')

router.use(limiter)
router.use(authMiddleware)
router.get('/', Controller.getDepartments)
router.get('/:id/detail', Controller.getDepartmentById)
router.post('/create', adminOnly, Controller.createDepartment)
router.put('/:id/update', adminOnly, Controller.updateDepartment)
router.delete('/:id/delete', adminOnly, Controller.deleteDepartment)
router.patch('/:id/status', adminOnly, Controller.toggleDepartmentStatus)

module.exports = router
