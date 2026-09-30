import Link from 'next/link'
import { getCasesWithStats } from '@/lib/queries'
import { PageHeader } from '@/components/page-header'
import { CreateCaseDialog } from '@/components/create-case-dialog'
import { StatusPill } from '@/components/case/status-pill'
import { DatabaseUnavailable } from '@/components/database-unavailable'
import { requireSession } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

export default async function CasesPage() {
  await requireSession()
  const cases = await getCasesWithStats().catch((error) => {
    console.error('[casemind] cases database query failed', error)
    return null
  })
  if (!cases) return <DatabaseUnavailable />
  return (
    <div className="flex flex-col gap-6 p-4 md:p-8">
      <PageHeader
        eyebrow="Cases"
        title="All investigations"
        description="Each investigation has a separate evidence record, timeline, people, contradictions, and case-local memory context. Demo records are fictional."
        action={<CreateCaseDialog />}
      />
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-medium">Case</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Evidence</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">People</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Contradictions</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => (
              <tr key={c.id} className="border-b last:border-0 hover:bg-muted/40">
                <td className="px-4 py-3">
                  <Link href={`/cases/${c.id}`} className="font-medium text-foreground hover:underline">
                    {c.title}
                  </Link>
                  {c.isDemo ? <StatusPill tone="memory" className="ml-2">Demo</StatusPill> : null}
                </td>
                <td className="px-4 py-3">
                  <StatusPill tone={c.contradictionCount ? 'challenged' : c.evidenceCount ? 'supported' : 'unresolved'}>
                    {c.statusLabel}
                  </StatusPill>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {c.evidenceCount}
                  {c.queuedCount ? <span className="text-muted-foreground"> (+{c.queuedCount} queued)</span> : null}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{c.peopleCount}</td>
                <td className="px-4 py-3 text-right tabular-nums">{c.contradictionCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
