const express = require('express')
const router = express.Router()

router.get('/status', (req, res) => {
  res.send('Running ⚡')
})

router.use('/auth', require('./modules/auth/index'))
router.use('/users', require('./modules/user/index'))
router.use('/departments', require('./modules/department/index'))
router.use('/employees', require('./modules/employee/index'))

module.exports = router
