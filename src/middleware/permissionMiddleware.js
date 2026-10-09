const db = require('../../db/models')

const requirePermission = (permissionKey) => async (req, res, next) => {
  try {
    const user = await db.User.findByPk(req.user?.id, {
      attributes: ['id', 'status', 'role_id'],
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

    const hasPermission = user.role.permissions.some((permission) => permission.key === permissionKey)
    if (!hasPermission) {
      return next({ statusCode: 403, message: `Permission required: ${permissionKey}` })
    }

    req.user.role = user.role.name
    req.user.status = user.status
    return next()
  } catch (err) {
    return next(err)
  }
}

module.exports = requirePermission