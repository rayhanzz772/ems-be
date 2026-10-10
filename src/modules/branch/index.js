'use strict'

const Controller = require('./controller')
const router = require('express').Router()
const authMiddleware = require('../../middleware/authMiddleware')
const requirePermission = require('../../middleware/permissionMiddleware')
const limiter = require('../../utils/limiter')

router.use(limiter)
router.use(authMiddleware)
router.get('/', requirePermission('branch.read'), Controller.getBranches)
router.get('/:id/detail', requirePermission('branch.read'), Controller.getBranchById)
router.post('/create', requirePermission('branch.create'), Controller.createBranch)
router.put('/:id/update', requirePermission('branch.update'), Controller.updateBranch)
router.delete('/:id/delete', requirePermission('branch.delete'), Controller.deleteBranch)
router.patch('/:id/status', requirePermission('branch.update'), Controller.toggleBranchStatus)

module.exports = router