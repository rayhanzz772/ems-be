const db = require('../../db/models')

const adminOnly = async (req, res, next) => {
	try {
		const user = await db.User.findByPk(req.user?.id, {
			attributes: ['id', 'role', 'status']
		})

		if (!user) {
			return next({ statusCode: 401, message: 'Authenticated user not found' })
		}

		if (!user.status) {
			return next({ statusCode: 403, message: 'User is inactive or suspended' })
		}

		if (user.role !== 'ADMIN') {
			return next({ statusCode: 403, message: 'Admin role is required' })
		}

		req.user.role = user.role
		req.user.status = user.status
		return next()
	} catch (err) {
		return next(err)
	}
}

module.exports = adminOnly
