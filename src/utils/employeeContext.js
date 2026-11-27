const { HttpStatusCode } = require('axios')
const db = require('../../db/models')

/**
 * Mengembalikan employee_id milik user, atau null bila belum tertaut.
 * Read-only dan tanpa cache: dengan skala saat ini satu query per request
 * jauh lebih murah daripada risiko cache basi setelah tautan diubah.
 */
const resolveEmployeeId = async (userId) => {
  if (!userId) return null
  const user = await db.User.findByPk(userId, {
    attributes: ['id', 'employee_id']
  })
  return user?.employee_id || null
}

/**
 * Dipakai endpoint *_self. Gagal keras dengan 409 supaya frontend tidak
 * salah menyimpulkan "karyawan tidak punya data" padahal tautannya hilang.
 */
const requireEmployeeId = async (req) => {
  const employeeId = await resolveEmployeeId(req.user?.id)
  if (!employeeId) {
    throw {
      code: HttpStatusCode.Conflict,
      message: 'User is not linked to an employee record'
    }
  }
  return employeeId
}

module.exports = {
  resolveEmployeeId,
  requireEmployeeId
}
