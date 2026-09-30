import { createHash, timingSafeEqual } from 'node:crypto'
import * as OTPAuth from 'otpauth'

export const INVALID_CREDENTIALS_MESSAGE = 'Invalid investigator credentials.'

function constantTimeStringEqual(actual, expected) {
  const actualDigest = createHash('sha256').update(actual, 'utf8').digest()
  const expectedDigest = createHash('sha256').update(expected, 'utf8').digest()
  return timingSafeEqual(actualDigest, expectedDigest)
}

/** Verify all factors server-side. `now` is injectable for deterministic tests. */
export function verifyInvestigatorCredentials(input, config, now = Date.now()) {
  if (!input || !config) return false
  const identifier = typeof input.identifier === 'string' ? input.identifier.trim() : ''
  const accessKey = typeof input.accessKey === 'string' ? input.accessKey : ''
  const investigatorCode = typeof input.investigatorCode === 'string' ? input.investigatorCode : ''
  const expectedIdentifier = typeof config.identifier === 'string' ? config.identifier.trim() : ''
  const expectedAccessKey = typeof config.accessKey === 'string' ? config.accessKey : ''
  const base32Secret = typeof config.totpSecret === 'string' ? config.totpSecret.trim().toUpperCase() : ''

  if (!expectedIdentifier || !expectedAccessKey || expectedAccessKey === 'CHANGE_ME') return false
  if (!/^[A-Z2-7]+=*$/.test(base32Secret) || base32Secret === 'CHANGE_ME_TO_A_BASE32_SECRET') return false
  if (identifier.toLowerCase() !== expectedIdentifier.toLowerCase()) return false
  if (!constantTimeStringEqual(accessKey, expectedAccessKey)) return false
  if (!/^\d{6}$/.test(investigatorCode)) return false

  try {
    const secret = OTPAuth.Secret.fromBase32(base32Secret)
    if (secret.bytes.length < 20) return false
    const totp = new OTPAuth.TOTP({ secret, algorithm: 'SHA1', digits: 6, period: 30 })
    return totp.validate({ token: investigatorCode, timestamp: now, window: 1 }) !== null
  } catch {
    return false
  }
}
