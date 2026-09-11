/**
 * 密码散列（scrypt + 随机盐）与令牌铸造。
 * 信封格式 `scrypt$<saltHex>$<hashHex>`；令牌只持久化 sha256 指纹。
 */
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto'

const KEYLEN = 32

/** 把密码散列成自描述的 scrypt 信封。 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, KEYLEN)
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`
}

/** 校验密码；任何畸形信封一律判假（fail closed）。 */
export function verifyPassword(password: string, envelope: string): boolean {
  const parts = envelope.split('$')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false
  const salt = Buffer.from(parts[1]!, 'hex')
  const expected = Buffer.from(parts[2]!, 'hex')
  if (salt.length === 0 || expected.length !== KEYLEN) return false
  const actual = scryptSync(password, salt, KEYLEN)
  return timingSafeEqual(actual, expected)
}

/** 铸造一枚 64 位十六进制 Bearer 令牌。 */
export function newToken(): string {
  return randomBytes(32).toString('hex')
}

/** 令牌的 sha256 指纹 —— 落盘的唯一形态。 */
export function tokenFingerprint(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
