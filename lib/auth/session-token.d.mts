export const SESSION_COOKIE_NAME: string
export const SESSION_LIFETIME_SECONDS: number
export type SessionMode = 'investigator' | 'demo'
export type SessionInfo = { mode: SessionMode; expiresAt: number }
export function getSessionSigningSecret(env?: NodeJS.ProcessEnv, mode?: string): string | null
export function createSessionToken(mode: SessionMode, secret: string, now?: number): string
export function verifySessionToken(token: string | undefined, secret: string | null, now?: number): SessionInfo | null
export function isProtectedPath(pathname: string): boolean
export function getAuthRedirect(pathname: string, session: SessionInfo | null): string | null
