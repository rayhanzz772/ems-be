const Controller = require('./controller')
const router = require('express').Router()
const authMiddleware = require('../../middleware/authMiddleware')
const adminOnly = require('../../middleware/roleMiddleware')
const limiter = require('../../utils/limiter')

router.use(limiter)
router.use(authMiddleware)
router.use(adminOnly)
router.get('/', Controller.getDepartments)
router.get('/:id/detail', Controller.getDepartmentById)
router.post('/create', Controller.createDepartment)
router.put('/:id/update', Controller.updateDepartment)
router.delete('/:id/delete', Controller.deleteDepartment)

module.exports = router
