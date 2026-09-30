import 'server-only'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import {
  SESSION_COOKIE_NAME,
  SESSION_LIFETIME_SECONDS,
  createSessionToken,
  getSessionSigningSecret,
  verifySessionToken,
} from './session-token.mjs'

export { SESSION_COOKIE_NAME } from './session-token.mjs'
export type { SessionInfo, SessionMode } from './session-token.mjs'

export async function readSession() {
  const secret = getSessionSigningSecret()
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value
  return verifySessionToken(token, secret)
}

export async function createSession(mode: 'investigator' | 'demo') {
  const secret = getSessionSigningSecret()
  if (!secret) throw new Error('CASEMIND_SESSION_SECRET must contain at least 32 characters in production.')
  const token = createSessionToken(mode, secret)
  ;(await cookies()).set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_LIFETIME_SECONDS,
  })
}

export async function clearSession() {
  ;(await cookies()).delete(SESSION_COOKIE_NAME)
}

export async function requireSession() {
  const session = await readSession()
  if (!session) redirect('/login')
  return session
}
