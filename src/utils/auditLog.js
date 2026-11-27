const cuid = require('cuid')
const db = require('../../db/models')

const VALID_ACTIONS = ['CREATE', 'UPDATE', 'DELETE']

/**
 * Menulis jejak audit.
 *
 * Aktor wajib jelas: `userId` untuk aksi pengguna, atau
 * `actorType: 'SYSTEM'` + `actorLabel` untuk aksi scheduler.
 * Tidak ada lagi fallback ke pengguna acak seperti versi sebelumnya —
 * menebak aktor lebih buruk daripada gagal menulis.
 */
const createAuditLog = async ({
  userId = null,
  actorType = 'USER',
  actorLabel = null,
  action,
  entity,
  entityId,
  oldData = null,
  newData = null,
  transaction = null
}) => {
  if (!VALID_ACTIONS.includes(action)) {
    throw new Error(`Invalid audit action: ${action}`)
  }

  if (actorType === 'SYSTEM') {
    if (!actorLabel) {
      throw new Error('actorLabel is required for system audit entries')
    }
  } else if (actorType === 'USER') {
    if (!userId) {
      throw new Error('userId is required for user audit entries')
    }
  } else {
    throw new Error(`Invalid actorType: ${actorType}`)
  }

  return db.AuditLog.create(
    {
      id: cuid(),
      user_id: actorType === 'USER' ? userId : null,
      actor_type: actorType,
      actor_label: actorLabel,
      action,
      entity,
      entity_id: entityId,
      old_data: oldData,
      new_data: newData
    },
    transaction ? { transaction } : undefined
  )
}

module.exports = {
  createAuditLog
}
