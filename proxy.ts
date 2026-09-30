import { NextResponse, type NextRequest } from 'next/server'
import { getAuthRedirect, getSessionSigningSecret, verifySessionToken } from '@/lib/auth/session-token.mjs'
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-token.mjs'

export function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
  const session = verifySessionToken(token, getSessionSigningSecret())
  const destination = getAuthRedirect(request.nextUrl.pathname, session)
  return destination ? NextResponse.redirect(new URL(destination, request.url)) : NextResponse.next()
}

export const config = {
  matcher: ['/', '/login', '/dashboard/:path*', '/cases/:path*'],
}
