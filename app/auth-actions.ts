'use server'

import { redirect } from 'next/navigation'
import { createSession, clearSession } from '@/lib/auth/session'
import { verifyInvestigatorCredentials } from '@/lib/auth/credentials.mjs'

export type LoginState = { error?: string } | null

const INVALID_CREDENTIALS = 'Invalid investigator credentials.'

export async function establishInvestigatorSession(_previousState: LoginState, formData: FormData): Promise<LoginState> {
  const valid = verifyInvestigatorCredentials({
    identifier: formData.get('identifier'),
    accessKey: formData.get('accessKey'),
    investigatorCode: formData.get('investigatorCode'),
  }, {
    identifier: process.env.CASEMIND_INVESTIGATOR_ID,
    accessKey: process.env.CASEMIND_ACCESS_KEY,
    totpSecret: process.env.CASEMIND_TOTP_SECRET,
  })

  if (!valid) return { error: INVALID_CREDENTIALS }
  try {
    await createSession('investigator')
  } catch {
    return { error: INVALID_CREDENTIALS }
  }
  redirect('/dashboard')
}

export async function enterDemoEnvironment() {
  await createSession('demo')
  redirect('/dashboard')
}

export async function logout() {
  await clearSession()
  redirect('/login')
}
