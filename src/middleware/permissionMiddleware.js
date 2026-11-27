const db = require('../../db/models')

const requirePermission = (permissionKey) => async (req, res, next) => {
  try {
    const required = Array.isArray(permissionKey) ? permissionKey : [permissionKey]

    const user = await db.User.findByPk(req.user?.id, {
      attributes: ['id', 'status', 'role_id', 'employee_id'],
      include: [{
        model: db.Role,
        as: 'role',
        attributes: ['id', 'name', 'status'],
        include: [{
          model: db.Permission,
          as: 'permissions',
          attributes: ['key']
        }]
      }]
    })

    if (!user) return next({ statusCode: 401, message: 'Authenticated user not found' })
    if (!user.status || !user.role?.status) {
      return next({ statusCode: 403, message: 'User or role is inactive' })
    }

    const permissionKeys = user.role.permissions.map((permission) => permission.key)
    const hasPermission = permissionKeys.some((key) => required.includes(key))
    if (!hasPermission) {
      return next({ statusCode: 403, message: `Permission required: ${required.join(' | ')}` })
    }

    req.user.role = user.role.name
    req.user.status = user.status
    req.user.employeeId = user.employee_id || null
    req.user.permissions = permissionKeys
    return next()
  } catch (err) {
    return next(err)
  }
}

module.exports = requirePermission
