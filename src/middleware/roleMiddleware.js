const db = require('../../db/models')

const adminOnly = async (req, res, next) => {
	try {
		const user = await db.User.findByPk(req.user?.id, {
			attributes: ['id', 'status', 'role_id'],
			include: [{ model: db.Role, as: 'role', attributes: ['id', 'name'] }]
		})

		if (!user) {
			return next({ statusCode: 401, message: 'Authenticated user not found' })
		}

		if (!user.status) {
			return next({ statusCode: 403, message: 'User is inactive or suspended' })
		}

		const roleName = user.role?.name || user.role_name || 'EMPLOYEE'
		if (roleName !== 'ADMIN') {
			return next({ statusCode: 403, message: 'Admin role is required' })
		}

		req.user.role = roleName
		req.user.status = user.status
		return next()
	} catch (err) {
		return next(err)
	}
}

module.exports = adminOnly
