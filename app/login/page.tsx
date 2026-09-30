import { InvestigationEntry } from '@/components/investigation-entry'
import { checkHindsightHealth } from '@/lib/memory/hindsight'
import type { Metadata, Viewport } from 'next'
import { redirect } from 'next/navigation'
import { readSession } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Investigation Access | CASEMIND',
  description: 'Enter the CASEMIND evidence continuity investigation environment.',
}
export const viewport: Viewport = { colorScheme: 'dark', themeColor: '#07111d' }

export default async function LoginPage() {
  if (await readSession()) redirect('/dashboard')
  const hindsight = await checkHindsightHealth()
  return <InvestigationEntry
    memoryStatus={hindsight.status === 'connected' ? 'CONNECTED' : hindsight.status === 'error' ? 'CONNECTION ERROR' : 'LOCAL DEMO'}
    memoryDetail={hindsight.detail}
  />
}
