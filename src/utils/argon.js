const argon2 = require('argon2')

async function hashPassword(password) {
  return await argon2.hash(password)
}

async function compare(password, hash) {
  return await argon2.verify(hash, password)
}

module.exports = { hashPassword, compare }