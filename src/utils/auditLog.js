const cuid = require('cuid')
const db = require('../../db/models')

const createAuditLog = async ({
  userId,
  action,
  entity,
  entityId,
  oldData = null,
  newData = null
}) => {
  const validActions = ['CREATE', 'UPDATE', 'DELETE']
  const normalizedAction = validActions.includes(action) ? action : 'CREATE'

  let resolvedUserId = userId

  if (!resolvedUserId && db.User) {
    const fallbackUser = await db.User.findOne({
      attributes: ['id'],
      raw: true
    })

    resolvedUserId = fallbackUser?.id || null
  }

  if (!resolvedUserId) {
    return null
  }

  return db.AuditLog.create({
    id: cuid(),
    user_id: resolvedUserId,
    action: normalizedAction,
    entity,
    entity_id: entityId,
    old_data: oldData,
    new_data: newData
  })
}

module.exports = {
  createAuditLog
}