const crypto = require('crypto')
const cuid = require('cuid')
const jwt = require('jsonwebtoken')
const { HttpStatusCode } = require('axios')
const db = require('../../../db/models')
const { createAuditLog } = require('../../utils/auditLog')

const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000
const ACCESS_TOKEN_TTL = '15m'
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000

const isProduction = () => process.env.NODE_ENV === 'production'

const accessCookieOptions = {
  httpOnly: true,
  sameSite: 'strict',
  path: '/'
}

const refreshCookieOptions = {
  httpOnly: true,
  sameSite: 'strict',
  path: '/api/v1/auth'
}

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex')

const generateRefreshToken = () => crypto.randomBytes(32).toString('hex')

const SESSION_STATES = {
  INVALID: 'INVALID',
  REPLAY: 'REPLAY',
  EXPIRED: 'EXPIRED',
  VALID: 'VALID'
}

/**
 * Klasifikasi murni, tanpa DB, supaya tiga jalur penolakan bisa diuji.
 * REPLAY berarti token sudah dirotasi/dicabut lalu dipakai lagi.
 */
const classifySession = (session, now = new Date()) => {
  if (!session) return SESSION_STATES.INVALID
  if (session.revoked_at) return SESSION_STATES.REPLAY
  if (new Date(session.expires_at).getTime() <= now.getTime()) return SESSION_STATES.EXPIRED
  return SESSION_STATES.VALID
}

const signAccessToken = ({ userId, employeeId, role, status, sessionId }) =>
  jwt.sign(
    { userId, employeeId: employeeId || null, role, status, sessionId },
    process.env.JWT_KEY,
    { expiresIn: ACCESS_TOKEN_TTL }
  )

const setAuthCookies = (res, { accessToken, refreshToken }) => {
  res.cookie('token', accessToken, {
    ...accessCookieOptions,
    secure: isProduction(),
    maxAge: ACCESS_TOKEN_TTL_MS
  })
  res.cookie('refresh_token', refreshToken, {
    ...refreshCookieOptions,
    secure: isProduction(),
    maxAge: REFRESH_TOKEN_TTL_MS
  })
}

const clearAuthCookies = (res) => {
  res.clearCookie('token', accessCookieOptions)
  res.clearCookie('refresh_token', refreshCookieOptions)
}

const createSession = async ({ userId, req, transaction }) => {
  const refreshToken = generateRefreshToken()
  const session = await db.UserSession.create(
    {
      id: cuid(),
      user_id: userId,
      refresh_token_hash: hashToken(refreshToken),
      expires_at: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      user_agent: req.headers?.['user-agent'] || null,
      ip_address: req.ip || null
    },
    { transaction }
  )
  return { session, refreshToken }
}

/**
 * Rotasi refresh token. Sesi lama selalu dimatikan; sesi baru menerbitkan
 * token baru. Token yang sudah dirotasi lalu dipakai ulang dianggap replay
 * dan mematikan seluruh sesi user — itu satu-satunya cara rotasi berguna.
 *
 * Penolakan dikembalikan sebagai data dari transaksi, lalu dilempar setelah
 * commit. Melempar di dalam transaksi akan me-rollback pencabutan sesi,
 * sehingga token curian tetap hidup.
 */
const rotateSession = async ({ refreshToken, req }) => {
  const tokenHash = hashToken(refreshToken)

  const outcome = await db.sequelize.transaction(async (transaction) => {
    const existing = await db.UserSession.findOne({
      where: { refresh_token_hash: tokenHash },
      lock: transaction.LOCK.UPDATE,
      transaction
    })

    const state = classifySession(existing)

    if (state === SESSION_STATES.INVALID) {
      return { error: 'Invalid refresh token' }
    }

    if (state === SESSION_STATES.REPLAY) {
      await db.UserSession.update(
        { revoked_at: new Date() },
        {
          where: { user_id: existing.user_id, revoked_at: null },
          transaction
        }
      )
      await createAuditLog({
        actorType: 'SYSTEM',
        actorLabel: 'auth:refresh-replay',
        action: 'UPDATE',
        entity: 'UserSession',
        entityId: existing.id,
        newData: { user_id: existing.user_id, action: 'revoke_all_on_replay' },
        transaction
      })
      return { error: 'Refresh token reuse detected' }
    }

    if (state === SESSION_STATES.EXPIRED) {
      return { error: 'Refresh token expired' }
    }

    const user = await db.User.findByPk(existing.user_id, {
      attributes: ['id', 'email', 'status', 'employee_id'],
      include: [{
        model: db.Role,
        as: 'role',
        attributes: ['id', 'name'],
        include: [{
          model: db.Permission,
          as: 'permissions',
          attributes: ['key']
        }]
      }],
      transaction
    })

    if (!user || !user.status || !user.role?.status) {
      return { error: 'User or role is inactive', code: HttpStatusCode.Forbidden }
    }

    const { session, refreshToken: nextRefreshToken } = await createSession({
      userId: existing.user_id,
      req,
      transaction
    })

    await existing.update(
      {
        revoked_at: new Date(),
        last_used_at: new Date(),
        replaced_by_session_id: session.id
      },
      { transaction }
    )

    return { user, session, refreshToken: nextRefreshToken }
  })

  if (outcome.error) {
    throw {
      code: outcome.code || HttpStatusCode.Unauthorized,
      message: outcome.error
    }
  }

  return outcome
}

const revokeSessionByToken = async ({ refreshToken }) => {
  if (!refreshToken) return null
  const session = await db.UserSession.findOne({
    where: { refresh_token_hash: hashToken(refreshToken) }
  })
  if (!session) return null
  if (!session.revoked_at) {
    await session.update({ revoked_at: new Date() })
  }
  return session
}

const revokeSessionById = async ({ sessionId, userId }) => {
  const session = await db.UserSession.findOne({
    where: { id: sessionId, user_id: userId }
  })
  if (!session) {
    throw { code: HttpStatusCode.NotFound, message: 'Session not found' }
  }
  if (!session.revoked_at) {
    await session.update({ revoked_at: new Date() })
  }
  return session
}

module.exports = {
  ACCESS_TOKEN_TTL,
  SESSION_STATES,
  classifySession,
  signAccessToken,
  hashToken,
  setAuthCookies,
  clearAuthCookies,
  createSession,
  rotateSession,
  revokeSessionByToken,
  revokeSessionById
}
