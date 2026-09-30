import { notFound } from 'next/navigation'
import { CaseWorkspace } from '@/components/case/case-workspace'
import { getCasesWithStats, getCaseBundle } from '@/lib/queries'
import { isModelConfigured } from '@/lib/agent/analyze'
import { bankIdForCase, initializeDemoCaseMemory, listCaseMemories } from '@/lib/memory/hindsight'
import { buildCaseMemoryItems } from '@/lib/memory/case-facts'
import { DatabaseUnavailable } from '@/components/database-unavailable'
import { requireSession } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

export default async function CasePage({ params }: { params: Promise<{ caseId: string }> }) {
  await requireSession()
  const { caseId: rawCaseId } = await params
  const caseId = Number(rawCaseId)
  if (!Number.isSafeInteger(caseId) || caseId < 1) notFound()

  let bundle
  try {
    bundle = await getCaseBundle(caseId)
  } catch (error) {
    console.error('[casemind] case database query failed', error)
    return <DatabaseUnavailable backHref="/cases" />
  }
  if (!bundle) notFound()

  const bankId = bankIdForCase(bundle.case.id)
  if (bundle.case.isDemo) {
    await initializeDemoCaseMemory(bundle.case.id, bundle.case.title, buildCaseMemoryItems(bundle)).catch((error) => {
      console.warn('[HINDSIGHT] demo case initialization failed')
      return error
    })
  }

  const [caseList, hindsight] = await Promise.all([
    getCasesWithStats().catch((error) => {
      console.error('[casemind] case switcher database query failed', error)
      return null
    }),
    listCaseMemories(bundle.case.id, bundle.case.title),
  ])
  if (!caseList) return <DatabaseUnavailable backHref="/cases" />

  return <CaseWorkspace
    bundle={bundle}
    cases={caseList.map((item) => ({ id: item.id, title: item.title }))}
    hindsight={{
      status: hindsight.health.status,
      detail: hindsight.health.detail,
      bankId: hindsight.bankId,
      apiVersion: hindsight.health.apiVersion,
      memories: hindsight.memories,
      memoryCount: hindsight.total,
      metrics: hindsight.metrics,
    }}
    modelConfigured={isModelConfigured()}
  />
}
