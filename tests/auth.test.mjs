import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import * as OTPAuth from 'otpauth'
import { verifyInvestigatorCredentials } from '../lib/auth/credentials.mjs'
import { createSessionToken, getAuthRedirect, getSessionSigningSecret, isProtectedPath, verifySessionToken } from '../lib/auth/session-token.mjs'
import { INVALID_CREDENTIALS_MESSAGE } from '../lib/auth/credentials.mjs'

const now = 1_700_000_000_000
const secret = new OTPAuth.Secret({ size: 20 }).base32
const config = { identifier: 'investigator@casemind.local', accessKey: 'local-test-access-key', totpSecret: secret }
const codeFor = (timestamp) => new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret), digits: 6, period: 30 }).generate({ timestamp })
const credentialsFor = (overrides = {}) => ({
  identifier: config.identifier,
  accessKey: config.accessKey,
  investigatorCode: codeFor(now),
  ...overrides,
})

test('valid identifier, access key, and standard six-digit TOTP authenticate', () => {
  assert.equal(verifyInvestigatorCredentials(credentialsFor(), config, now), true)
})

test('invalid identifier is rejected', () => {
  assert.equal(verifyInvestigatorCredentials(credentialsFor({ identifier: 'someone-else' }), config, now), false)
})

test('invalid access key is rejected', () => {
  assert.equal(verifyInvestigatorCredentials(credentialsFor({ accessKey: 'incorrect' }), config, now), false)
})

test('invalid and missing investigator codes are rejected with the same generic auth failure', () => {
  const validWindowCodes = new Set([now - 30_000, now, now + 30_000].map(codeFor))
  let wrongCode = '000000'
  while (validWindowCodes.has(wrongCode)) wrongCode = String((Number(wrongCode) + 1) % 1_000_000).padStart(6, '0')
  assert.equal(verifyInvestigatorCredentials(credentialsFor({ investigatorCode: wrongCode }), config, now), false)
  assert.equal(verifyInvestigatorCredentials(credentialsFor({ investigatorCode: '' }), config, now), false)
  assert.equal(verifyInvestigatorCredentials(credentialsFor({ investigatorCode: '12345' }), config, now), false)
  assert.equal(INVALID_CREDENTIALS_MESSAGE, 'Invalid investigator credentials.')
})

test('TOTP allows one 30-second clock step and rejects a code outside that window', () => {
  const currentCode = codeFor(now)
  assert.equal(verifyInvestigatorCredentials(credentialsFor({ investigatorCode: currentCode }), config, now + 30_000), true)
  let expiredAt = now + 120_000
  while ([expiredAt - 30_000, expiredAt, expiredAt + 30_000].some((timestamp) => codeFor(timestamp) === currentCode)) expiredAt += 30_000
  assert.equal(verifyInvestigatorCredentials(credentialsFor({ investigatorCode: currentCode }), config, expiredAt), false)
})

test('missing and placeholder credential configuration fail closed', () => {
  assert.equal(verifyInvestigatorCredentials(credentialsFor(), { ...config, accessKey: undefined }, now), false)
  assert.equal(verifyInvestigatorCredentials(credentialsFor(), { ...config, totpSecret: 'CHANGE_ME_TO_A_BASE32_SECRET' }, now), false)
})

test('signed investigator and demo sessions route to the existing dashboard', () => {
  const signingKey = 'x'.repeat(48)
  const investigator = verifySessionToken(createSessionToken('investigator', signingKey, now), signingKey, now + 1_000)
  const demo = verifySessionToken(createSessionToken('demo', signingKey, now), signingKey, now + 1_000)
  assert.equal(investigator?.mode, 'investigator')
  assert.equal(demo?.mode, 'demo')
  assert.equal(getAuthRedirect('/login', investigator), '/dashboard')
  assert.equal(getAuthRedirect('/', null), '/login')
  assert.equal(getAuthRedirect('/', investigator), '/dashboard')
  assert.equal(getAuthRedirect('/dashboard', investigator), null)
  assert.equal(getAuthRedirect('/dashboard', demo), null)
  assert.equal(getAuthRedirect('/cases', demo), null)
})

test('missing, tampered, and expired sessions are rejected and protected routes go to login', () => {
  const signingKey = 'y'.repeat(48)
  const token = createSessionToken('investigator', signingKey, now)
  assert.equal(verifySessionToken(undefined, signingKey, now), null)
  assert.equal(verifySessionToken(`${token}x`, signingKey, now), null)
  assert.equal(verifySessionToken(token, signingKey, now + 13 * 60 * 60 * 1000), null)
  for (const path of ['/dashboard', '/cases', '/cases/1', '/cases/2']) {
    assert.equal(isProtectedPath(path), true)
    assert.equal(getAuthRedirect(path, null), '/login')
  }
})

test('production requires a dedicated session signing secret', () => {
  assert.equal(getSessionSigningSecret({}, 'production'), null)
  assert.equal(getSessionSigningSecret({ CASEMIND_SESSION_SECRET: 'z'.repeat(40) }, 'production'), 'z'.repeat(40))
})

test('TOTP secret and auth credentials are server-only; cookies are HttpOnly', async () => {
  const clientEntry = await readFile(new URL('../components/investigation-entry.tsx', import.meta.url), 'utf8')
  const authAction = await readFile(new URL('../app/auth-actions.ts', import.meta.url), 'utf8')
  const sessionModule = await readFile(new URL('../lib/auth/session.ts', import.meta.url), 'utf8')
  assert.equal(clientEntry.includes('CASEMIND_TOTP_SECRET'), false)
  assert.equal(clientEntry.includes('CASEMIND_ACCESS_KEY'), false)
  assert.equal(clientEntry.includes('CASEMIND_INVESTIGATOR_ID'), false)
  assert.equal(clientEntry.includes('localStorage'), false)
  assert.equal(clientEntry.includes('sessionStorage'), false)
  assert.equal(authAction.includes('verifyInvestigatorCredentials'), true)
  assert.match(sessionModule, /httpOnly:\s*true/)
  assert.match(sessionModule, /sameSite:\s*'lax'/)
  assert.match(sessionModule, /secure:\s*process\.env\.NODE_ENV\s*===\s*'production'/)
})

test('demo entry remains a separate server-side session action', async () => {
  const authAction = await readFile(new URL('../app/auth-actions.ts', import.meta.url), 'utf8')
  const clientEntry = await readFile(new URL('../components/investigation-entry.tsx', import.meta.url), 'utf8')
  assert.match(authAction, /establishInvestigatorSession[\s\S]*?createSession\('investigator'\)[\s\S]*?redirect\('\/dashboard'\)/)
  assert.match(authAction, /enterDemoEnvironment[\s\S]*?createSession\('demo'\)[\s\S]*?redirect\('\/dashboard'\)/)
  assert.match(authAction, /establishInvestigatorSession[\s\S]*?verifyInvestigatorCredentials/)
  assert.match(clientEntry, /ENTER DEMO ENVIRONMENT/)
})

test('Hindsight login status requires an authenticated API operation, not only public version info', async () => {
  const adapter = await readFile(new URL('../lib/memory/hindsight.ts', import.meta.url), 'utf8')
  const probe = adapter.slice(adapter.indexOf('export async function checkHindsightHealth'), adapter.indexOf('export type RetainItem'))
  assert.match(probe, /createBank\(bankId/)
  assert.match(probe, /bank\.bank_id !== bankId/)
  assert.ok(probe.indexOf('await hs.createBank') < probe.indexOf('await hs.getVersion'))
  assert.match(probe, /HINDSIGHT_BASE_URL/)
  assert.match(probe, /HINDSIGHT_API_KEY/)
  assert.doesNotMatch(probe, /console\.(?:info|warn|error)\([^\n]*(?:apiKey|API_KEY|key)/i)
})
