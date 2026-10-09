const express = require('express')
const router = express.Router()

router.get('/status', (req, res) => {
  res.send('Running ⚡')
})

router.use('/dashboard', require('./modules/dashboard/index'))
router.use('/auth', require('./modules/auth/index'))
router.use('/permissions', require('./modules/permission/index'))
router.use('/roles', require('./modules/role/index'))
router.use('/users', require('./modules/user/index'))
router.use('/departments', require('./modules/department/index'))
router.use('/employees', require('./modules/employee/index'))
router.use('/audit-logs', require('./modules/audit-log/index'))

module.exports = router
