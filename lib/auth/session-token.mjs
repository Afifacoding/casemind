import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

export const SESSION_COOKIE_NAME = 'casemind_session'
export const SESSION_LIFETIME_SECONDS = 12 * 60 * 60

let developmentSigningSecret

export function getSessionSigningSecret(env = process.env, mode = process.env.NODE_ENV) {
  if (typeof env.CASEMIND_SESSION_SECRET === 'string' && env.CASEMIND_SESSION_SECRET.length >= 32 && !env.CASEMIND_SESSION_SECRET.includes('CHANGE_ME')) {
    return env.CASEMIND_SESSION_SECRET
  }
  if (mode === 'production') return null
  developmentSigningSecret ??= 'casemind-only-development-session-key-not-for-production'
  return developmentSigningSecret
}

function signature(value, secret) {
  return createHmac('sha256', secret).update(value).digest('base64url')
}

export function createSessionToken(mode, secret, now = Date.now()) {
  if (!secret || !['investigator', 'demo'].includes(mode)) throw new Error('A valid session signing key and mode are required.')
  const issuedAt = Math.floor(now / 1000)
  const payload = Buffer.from(JSON.stringify({ mode, issuedAt, expiresAt: issuedAt + SESSION_LIFETIME_SECONDS, nonce: randomBytes(12).toString('base64url') })).toString('base64url')
  const signed = `v1.${payload}`
  return `${signed}.${signature(signed, secret)}`
}

export function verifySessionToken(token, secret, now = Date.now()) {
  if (!secret || typeof token !== 'string' || token.length > 2048) return null
  const [version, payload, suppliedSignature, extra] = token.split('.')
  if (version !== 'v1' || !payload || !suppliedSignature || extra !== undefined) return null
  const signed = `${version}.${payload}`
  const expected = Buffer.from(signature(signed, secret))
  const provided = Buffer.from(suppliedSignature)
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    const nowSeconds = Math.floor(now / 1000)
    if (!['investigator', 'demo'].includes(session.mode)) return null
    if (!Number.isInteger(session.issuedAt) || !Number.isInteger(session.expiresAt) || session.issuedAt > nowSeconds + 30 || session.expiresAt <= nowSeconds) return null
    return { mode: session.mode, expiresAt: session.expiresAt }
  } catch {
    return null
  }
}

export function isProtectedPath(pathname) {
  return pathname === '/dashboard' || pathname.startsWith('/dashboard/') || pathname === '/cases' || pathname.startsWith('/cases/')
}

export function getAuthRedirect(pathname, session) {
  if (isProtectedPath(pathname) && !session) return '/login'
  if ((pathname === '/login' || pathname === '/') && session) return '/dashboard'
  if (pathname === '/') return '/login'
  return null
}
