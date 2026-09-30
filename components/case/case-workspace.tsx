'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Activity, AlertTriangle, ArrowDown, ArrowRight, ArrowUp, BookOpen, ChevronRight, Clock3, FilePlus2, GitCompareArrows, RotateCcw, Sparkles, CircleHelp } from 'lucide-react'
import { addEvidence, reflectOnInvestigation, resetDemoCase, retryEvidence, runDemoStep, updateContradictionStatus } from '@/app/actions'
import { EVIDENCE_TYPES } from '@/lib/types'
import type { CaseBundle } from '@/lib/queries'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState, EvidenceRef, SectionHeading, StatusPill } from './status-pill'

const sections = [
  ['overview', 'Overview'], ['evidence', 'Evidence'], ['people', 'People'], ['timeline', 'Timeline'],
  ['contradictions', 'Contradictions'], ['changed', 'What changed?'], ['believe', 'Why do we believe this?'],
  ['memory', 'Investigation memory'], ['scores', 'Score history'],
] as const

type Props = {
  bundle: CaseBundle
  cases: { id: number; title: string }[]
  hindsight: {
    status: 'connected' | 'not-configured' | 'error'
    detail: string
    bankId: string
    apiVersion?: string
    memories: { id: string; text: string; type: string | null; occurredAt: string | null }[]
    memoryCount: number
    metrics: { retainedItems: number; recalledMemories: number; reflectionsGenerated: number }
  }
  modelConfigured: boolean
}

type Selection = { kind: 'person'; id: string } | { kind: 'claim'; id: string } | { kind: 'event'; id: string } | null

export function CaseWorkspace({ bundle, cases, hindsight, modelConfigured }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [reflection, setReflection] = useState('')
  const [reflectionResult, setReflectionResult] = useState<{ text: string; sources: { id: string; text: string; type: string | null; occurredAt: string | null }[] } | null>(null)
  const firstSelection = bundle.people[0]
    ? { kind: 'person' as const, id: String(bundle.people[0].id) }
    : bundle.claims[0]
      ? { kind: 'claim' as const, id: String(bundle.claims[0].id) }
      : null
  const [selection, setSelection] = useState<Selection>(firstSelection)
  const latestDay = Math.max(0, ...bundle.evidence.map((item) => item.investigationDay))
  const queuedCount = bundle.evidence.filter((item) => item.status === 'queued').length
  const unresolvedCount = bundle.contradictions.filter((item) => !['explained', 'resolved'].includes(item.status)).length

  function doAction(action: () => Promise<{ ok: boolean; message?: string; error?: string }>, success?: string) {
    startTransition(async () => {
      try {
        const result = await action()
        if (!result.ok) toast.error(result.error ?? 'The request could not be completed.')
        else {
          toast.success(success ?? result.message ?? 'Investigation updated.')
          router.refresh()
        }
      } catch {
        toast.error('The request failed. Check the database and external service configuration, then retry.')
      }
    })
  }

  function processNext() {
    doAction(() => runDemoStep(bundle.case.id))
  }

  function resetCase() {
    if (!window.confirm('Reset this fictional demo case and clear its evidence analysis and Hindsight bank?')) return
    doAction(() => resetDemoCase(bundle.case.id))
  }

  function submitEvidence(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    startTransition(async () => {
      try {
        const result = await addEvidence({
          caseId: bundle.case.id,
          title: String(form.get('title') ?? ''),
          evidenceType: String(form.get('evidenceType') ?? 'Other') as (typeof EVIDENCE_TYPES)[number],
          content: String(form.get('content') ?? ''),
          investigationDay: Number(form.get('investigationDay')),
        })
        if (!result.ok) toast.error(result.error)
        else {
          toast.success(result.message)
          formElement.reset()
          router.refresh()
        }
      } catch {
        toast.error('Evidence could not be saved. Check the database configuration and retry.')
      }
    })
  }

  function submitReflection(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      try {
        const result = await reflectOnInvestigation(bundle.case.id, reflection)
        if (!result.ok) toast.error(result.error)
        else {
          setReflectionResult({ text: result.text, sources: result.sources })
          toast.success('Hindsight reflection received.')
          router.refresh()
        }
      } catch {
        toast.error('Reflection could not be completed. Check Hindsight configuration and retry.')
      }
    })
  }

  const selectedPerson = selection?.kind === 'person' ? bundle.people.find((person) => String(person.id) === selection.id) : undefined
  const selectedClaim = selection?.kind === 'claim' ? bundle.claims.find((claim) => String(claim.id) === selection.id) : undefined
  const selectedEvent = selection?.kind === 'event' ? bundle.events.find((item) => String(item.id) === selection.id) : undefined
  const selectedLabel = selectedPerson?.name ?? selectedClaim?.statement ?? selectedEvent?.title ?? 'Investigation item'

  const directPersonEvidence = selectedPerson
    ? bundle.evidence.filter((item) => item.analysis?.peopleMentioned.includes(selectedPerson.name))
    : []
  const directlyLinkedIds = new Set(directPersonEvidence.map((item) => item.id))
  const personConflictIds = new Set(selectedPerson
    ? bundle.contradictions
      .filter((conflict) => conflict.description.includes(selectedPerson.name))
      .flatMap((conflict) => [conflict.evidenceId, conflict.conflictingEvidenceId])
    : [])
  const contextEvidenceIds = new Set(selectedPerson
    ? bundle.contradictions
      .filter((conflict) => directlyLinkedIds.has(conflict.evidenceId) || directlyLinkedIds.has(conflict.conflictingEvidenceId))
      .flatMap((conflict) => [conflict.evidenceId, conflict.conflictingEvidenceId])
      .filter((id) => !directlyLinkedIds.has(id))
    : [])
  const relatedContextEvidence = bundle.evidence.filter((item) => contextEvidenceIds.has(item.id))
  const evidenceForSelection = selectedPerson
    ? directPersonEvidence
    : selectedClaim
      ? bundle.evidence.filter((item) => selectedClaim.supportingEvidenceIds.includes(item.id) || selectedClaim.contradictingEvidenceIds.includes(item.id))
      : selectedEvent
        ? bundle.evidence.filter((item) => item.id === selectedEvent.evidenceId)
        : []
  const supportingEvidence = selectedPerson
    ? evidenceForSelection.filter((item) => !personConflictIds.has(item.id) && !/not in|elsewhere|conflict|contradict/i.test(item.analysis?.summary ?? ''))
    : selectedClaim
      ? bundle.evidence.filter((item) => selectedClaim.supportingEvidenceIds.includes(item.id))
      : evidenceForSelection
  const challengingEvidence = selectedPerson
    ? evidenceForSelection.filter((item) => personConflictIds.has(item.id) || /not in|elsewhere|conflict|contradict/i.test(item.analysis?.summary ?? ''))
    : selectedClaim
      ? bundle.evidence.filter((item) => selectedClaim.contradictingEvidenceIds.includes(item.id))
      : []
  const selectedScoreHistory = selectedPerson ? bundle.scoreHistory.filter((entry) => entry.personId === selectedPerson.id) : []
  const lastUpdatedDay = selectedPerson
    ? Math.max(0, ...selectedScoreHistory.map((entry) => entry.investigationDay))
    : selectedClaim?.lastUpdatedDay ?? selectedEvent?.investigationDay ?? 0
  const relatedEvidenceIds = new Set(evidenceForSelection.map((item) => item.id))
  const relatedTimelineEntries = (selectedEvent
    ? [selectedEvent]
    : bundle.events.filter((item) => relatedEvidenceIds.has(item.evidenceId)
      || Boolean(selectedPerson && item.people.includes(selectedPerson.name))
      || Boolean(selectedClaim && selectedClaim.relatedEvents.includes(item.title))))
    .map((item) => `Day ${item.investigationDay} · ${item.title} · ${item.timeLabel}${item.location ? ` · ${item.location}` : ''}`)

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 p-4 md:gap-7 md:p-8">
      <header className="-mx-4 flex flex-col gap-4 border-b bg-background px-4 pb-3 pt-1 md:-mx-8 md:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/dashboard" className="text-xs font-medium text-muted-foreground hover:text-foreground">CASEMIND</Link>
              <ChevronRight className="size-3 text-muted-foreground" aria-hidden="true" />
              <span className="text-xs text-muted-foreground">Investigation workspace</span>
              {bundle.case.isDemo ? <StatusPill tone="memory">Fictional demo</StatusPill> : null}
            </div>
            <div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{bundle.case.title}</h1><StatusPill tone={unresolvedCount ? 'challenged' : 'supported'}>{bundle.statusLabel}</StatusPill></div>
            <p className="max-w-3xl text-xs text-muted-foreground">Investigation support · Evidence connection strength is not a determination of guilt.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="case-switcher">Switch investigation</label>
            <select id="case-switcher" value={bundle.case.id} onChange={(event) => router.push(`/cases/${event.target.value}`)} className="h-9 max-w-56 rounded-md border bg-background px-3 text-sm">
              {cases.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
            {bundle.case.isDemo ? <Button variant="outline" disabled={pending} onClick={resetCase}><RotateCcw />Reset demo</Button> : null}
            <Button disabled={pending || queuedCount === 0} onClick={processNext}>
              <Sparkles />{pending ? 'Processing…' : queuedCount ? `Process next · ${queuedCount} queued` : 'All demo evidence processed'}
            </Button>
          </div>
        </div>
        <nav aria-label="Switch investigation" className="flex gap-1 overflow-x-auto">
          {cases.map((item) => <Link key={item.id} href={`/cases/${item.id}`} aria-current={item.id === bundle.case.id ? 'page' : undefined} className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${item.id === bundle.case.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>{item.title}</Link>)}
        </nav>
        <nav aria-label="Case sections" className="flex gap-1 overflow-x-auto">
          {sections.map(([id, title]) => <a key={id} href={`#${id}`} className={`shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium ${id === 'changed' ? 'text-primary hover:bg-primary/5' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>{title}</a>)}
        </nav>
      </header>

      <section id="overview" className="scroll-mt-6 flex flex-col gap-4">
        <div className="grid grid-cols-2 divide-x divide-y rounded-lg border bg-card sm:grid-cols-3 sm:divide-y-0 lg:grid-cols-5">
          <Metric label="Evidence" value={bundle.evidence.filter((item) => item.status === 'analyzed').length} detail={queuedCount ? `${queuedCount} queued` : 'Analyzed'} />
          <Metric label="People connected" value={bundle.people.length} detail="Neutral context" />
          <Metric label="Events" value={bundle.events.length} detail="Chronological records" />
          <Metric label="Contradictions" value={bundle.contradictions.length} detail={`${unresolvedCount} unresolved / investigating`} />
          <Metric label="Open questions" value={bundle.unresolvedQuestions.length} detail="For investigator review" />
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.78fr)]">
          <section className="flex flex-col justify-center gap-3 border-l-2 border-primary/40 py-1 pl-4" aria-labelledby="case-summary-heading">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span className="font-semibold uppercase tracking-[0.12em] text-primary">Case brief</span><span>·</span><span>Updated {formatDate(bundle.case.updatedAt)}</span></div>
            <h2 id="case-summary-heading" className="sr-only">Case summary</h2>
            <p className="max-w-4xl text-sm leading-6 text-foreground">{bundle.case.summary || 'No evidence has been analyzed yet. Process the next fictional evidence item to start evolving the investigation state.'}</p>
            <p className="text-xs text-muted-foreground">Created {formatDate(bundle.case.createdAt)} · {bundle.case.isDemo ? 'Synthetic case data' : 'Investigation record'}</p>
            {!modelConfigured ? <p className="text-xs text-muted-foreground">Analysis mode: deterministic demo rules. No AI provider or external memory connection is implied.</p> : null}
          </section>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><FilePlus2 className="size-4" />Add evidence</CardTitle><CardDescription>New evidence is analyzed immediately and updates only this case.</CardDescription></CardHeader>
            <CardContent>
              <form onSubmit={submitEvidence} className="flex flex-col gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5"><Label htmlFor="new-evidence-title">Title</Label><Input id="new-evidence-title" name="title" required minLength={3} maxLength={160} placeholder="Updated access record" /></div>
                  <div className="flex flex-col gap-1.5"><Label htmlFor="new-evidence-type">Type</Label><select id="new-evidence-type" name="evidenceType" className="h-8 rounded-md border bg-background px-2 text-sm">{EVIDENCE_TYPES.map((type) => <option key={type}>{type}</option>)}</select></div>
                </div>
                <div className="flex flex-col gap-1.5"><Label htmlFor="new-evidence-day">Investigation day</Label><Input id="new-evidence-day" name="investigationDay" type="number" min={1} max={365} required defaultValue={latestDay + 1} /></div>
                <div className="flex flex-col gap-1.5"><Label htmlFor="new-evidence-content">Evidence text</Label><Textarea id="new-evidence-content" name="content" required minLength={10} maxLength={6000} rows={3} placeholder="Enter the fictional evidence details…" /></div>
                <Button type="submit" disabled={pending} className="self-start">{pending ? 'Analyzing…' : 'Add and analyze evidence'}</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="evidence" className="scroll-mt-6 flex flex-col gap-4">
        <SectionHeading title="Evidence" description="Evidence, extracted details, entity links, and analysis status are scoped to this investigation." />
        {!bundle.evidence.length ? <EmptyState title="No evidence yet" description="Add fictional or investigator-provided evidence above to begin the continuity workflow." /> : (
          <div className="grid gap-3">
            {bundle.evidence.map((item) => {
              const relatedEvents = bundle.events.filter((event) => event.evidenceId === item.id)
              const relatedLinks = bundle.relationships.filter((link) => link.evidenceId === item.id)
              return <details key={item.id} className="group rounded-lg border bg-card">
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-2"><EvidenceRef id={item.id} /><span className="text-xs text-muted-foreground">Day {item.investigationDay} · {item.evidenceType}</span><StatusPill tone={item.status === 'analyzed' ? 'supported' : item.status === 'failed' ? 'challenged' : 'neutral'}>{item.status}</StatusPill>{item.analysis?.analysisMode ? <StatusPill tone="memory">{item.analysis.analysisMode === 'llm' ? 'LLM analysis' : 'Deterministic demo analysis'}</StatusPill> : null}</div>
                    <span className="font-medium">{item.title}</span>
                  </div>
                  <span className="text-xs text-primary group-open:hidden">Inspect details</span><span className="hidden text-xs text-primary group-open:inline">Close details</span>
                </summary>
                <div className="flex flex-col gap-4 border-t p-4">
                  <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">Source:</span> {item.title} · {item.evidenceType}</p>
                  <p className="whitespace-pre-wrap text-sm leading-6">{item.content}</p>
                  {item.analysis ? <>
                    <p className="text-sm text-muted-foreground">{item.analysis.summary}</p>
                    <div className="grid gap-3 md:grid-cols-3">
                      <FactList label="Extracted people" items={item.analysis.peopleMentioned} />
                      <FactList label="Locations · times" items={[...item.analysis.locations, ...item.analysis.times]} />
                      <FactList label="Findings" items={item.analysis.findings} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {relatedEvents.map((event) => <StatusPill key={event.id} tone="neutral">{event.title} · {event.timeLabel}</StatusPill>)}
                      {relatedLinks.map((relation) => <StatusPill key={relation.id} tone="memory">{relation.source} {relation.kind} {relation.target}</StatusPill>)}
                    </div>
                    {item.analysis.unresolvedQuestions.length ? <FactList label="Unresolved questions" items={item.analysis.unresolvedQuestions} /> : null}
                  </> : null}
                  {item.error ? <p className="text-sm text-destructive">{item.error}</p> : null}
                  {item.status === 'failed' ? <Button variant="outline" size="sm" disabled={pending} onClick={() => doAction(() => retryEvidence(item.id))}>Retry analysis</Button> : null}
                </div>
              </details>
            })}
          </div>
        )}
      </section>

      <section id="people" className="scroll-mt-6 flex flex-col gap-4">
        <SectionHeading title="People connected to this investigation" description="Association scores summarize evidence links only; they are not guilt probabilities." />
        {!bundle.people.length ? <EmptyState title="No people extracted yet" description="People will appear here when evidence analysis connects a person to an event or location." /> : (
          <div className="grid gap-3 md:grid-cols-2">
            {bundle.people.map((person) => {
              const scoreDelta = person.score - person.previousScore
              const history = bundle.scoreHistory.filter((entry) => entry.personId === person.id)
              const relatedEvidence = bundle.evidence.filter((item) => item.analysis?.peopleMentioned.includes(person.name))
              const associatedEvents = bundle.events.filter((item) => item.people.includes(person.name))
              return <Card key={person.id} className="cursor-pointer hover:ring-primary/30" onClick={() => setSelection({ kind: 'person', id: String(person.id) })}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>{person.name}</CardTitle><CardDescription>{person.role || 'Context not specified'}</CardDescription></div><StatusPill tone="memory">Evidence-linked</StatusPill></div>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex items-end justify-between"><div><p className="text-xs text-muted-foreground">Evidence Association Score</p><p className="text-2xl font-semibold tabular-nums">{person.score}<span className="text-sm text-muted-foreground">/100</span></p></div><span className={`flex items-center gap-1 text-xs ${scoreDelta >= 0 ? 'text-supported-foreground' : 'text-challenged-foreground'}`}>{scoreDelta >= 0 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}{scoreDelta >= 0 ? '+' : ''}{scoreDelta} latest change</span></div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${person.score}%` }} /></div>
                  <p className="text-xs text-muted-foreground">{relatedEvidence.length} evidence connections · {associatedEvents.length} related events · {history.length} score changes</p>
                  <div className="flex flex-wrap gap-1">{history.at(-1)?.factors.map((factor, index) => <span key={`${factor.factor}-${index}`} title={factor.explanation} className="rounded bg-muted px-2 py-1 text-[11px]">{factor.weight > 0 ? '+' : ''}{factor.weight} {factor.label}</span>)}</div>
                  <a href="#believe" onClick={(event) => { event.stopPropagation(); setSelection({ kind: 'person', id: String(person.id) }) }} className="text-xs font-semibold text-primary hover:underline">Review evidence basis <span aria-hidden="true">→</span></a>
                </CardContent>
              </Card>
            })}
          </div>
        )}
      </section>

      <section id="timeline" className="scroll-mt-6 flex flex-col gap-4">
        <SectionHeading title="Investigation timeline" description="Chronological evidence arrivals and their effect on the evolving case state." />
        {!bundle.evidence.length ? <EmptyState title="Timeline is empty" description="Process the demo sequence or add evidence to populate a case-specific timeline." /> : (
          <ol className="relative flex flex-col gap-0 border-l border-border pl-5">
            {bundle.evidence.map((item) => {
              const itemConflicts = bundle.contradictions.filter((conflict) => conflict.evidenceId === item.id)
              const laterChallenged = bundle.contradictions.some((conflict) => conflict.conflictingEvidenceId === item.id && conflict.evidenceId !== item.id)
              const relatedEvents = bundle.events.filter((event) => event.evidenceId === item.id)
              const clarification = /corrected|corrects|scheduled time|scheduled—not actual|actual move/i.test(item.analysis?.summary ?? '')
              const timelineStatus = itemConflicts.length ? 'Challenges · conflict' : clarification ? 'Clarifies timing' : laterChallenged ? 'Later referenced in a conflict' : item.analysis?.peopleMentioned.length ? 'Connection evidence' : 'Timeline context'
              return <li key={item.id} className="relative pb-5 last:pb-0">
                <span className={`absolute -left-[25px] top-1.5 size-2.5 rounded-full border-2 border-background ${itemConflicts.length ? 'bg-challenged' : item.status === 'analyzed' ? 'bg-supported' : 'bg-muted-foreground'}`} />
                <div className="rounded-lg border bg-card p-4">
                  <div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Day {item.investigationDay}</span><EvidenceRef id={item.id} /><StatusPill tone="neutral">{item.evidenceType}</StatusPill><StatusPill tone={itemConflicts.length ? 'challenged' : clarification ? 'supported' : 'neutral'}>{timelineStatus}</StatusPill></div>
                  <h3 className="mt-2 font-medium">{item.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{item.analysis?.summary ?? item.content}</p>
                  {relatedEvents.map((event) => <p key={event.id} className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="size-3" />{event.timeLabel} · {event.location || 'Location not stated'}{event.people.length ? ` · ${event.people.join(', ')}` : ''}</p>)}
                  {itemConflicts.map((conflict) => <p key={conflict.id} className="mt-2 flex items-center gap-2 text-xs text-challenged-foreground"><AlertTriangle className="size-3.5" />Timeline conflict detected: {conflict.description}</p>)}
                </div>
              </li>
            })}
          </ol>
        )}
      </section>

      <section id="contradictions" className="scroll-mt-6 flex flex-col gap-4">
        <SectionHeading title="Contradictions" description="Conflicting sources are presented neutrally; CASEMIND does not decide which account is truthful." />
        {bundle.case.slug === 'warehouse-theft' ? <div className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3" aria-label="Warehouse delivery time evidence">
          <SignalCell label="Witness estimate · Day 1" value={bundle.evidence.find((item) => item.investigationDay === 1)?.analysis?.times[0] ?? 'Not recorded'} detail="Approximately 8:00 PM" />
          <SignalCell label="Delivery system · Day 3" value={bundle.evidence.find((item) => item.investigationDay === 3)?.analysis?.times[0] ?? 'Not recorded'} detail="Recorded completion" />
          <SignalCell label="Access + CCTV · Days 5–6" value="3:35–3:50 PM" detail="Access at 3:35 · CCTV observation window" challenged />
        </div> : bundle.case.slug === 'missing-equipment' ? <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-4 py-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Equipment trail</span><StatusPill tone="memory">TC-9</StatusPill><StatusPill tone="neutral">Storage Room A</StatusPill><ArrowRight className="size-3.5 text-muted-foreground" aria-hidden="true" /><StatusPill tone="neutral">Room C</StatusPill><span className="text-xs text-muted-foreground">Scheduled 11:00 AM · witness at 2:00 PM · corrected actual move 2:45 PM</span>
        </div> : null}
        {!bundle.contradictions.length ? <EmptyState title="No contradictions identified yet" description="Conflicts will appear when analyzed evidence challenges an earlier claim, time, location, or account." /> : (
          <div className="grid gap-3">
            {bundle.contradictions.map((conflict) => {
              const first = bundle.evidence.find((item) => item.id === conflict.conflictingEvidenceId)
              const second = bundle.evidence.find((item) => item.id === conflict.evidenceId)
              return <Card key={conflict.id}>
                <CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle className="flex items-center gap-2"><GitCompareArrows className="size-4 text-challenged-foreground" />What conflicts</CardTitle><StatusPill tone={conflict.status === 'resolved' || conflict.status === 'explained' ? 'supported' : 'challenged'}>{conflict.status}</StatusPill></div><CardDescription>Day {conflict.investigationDay} · {conflict.kind} discrepancy</CardDescription></CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <EvidenceCompare label="Earlier evidence" evidence={first} />
                    <EvidenceCompare label="New evidence" evidence={second} />
                  </div>
                  <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Why it conflicts</p><p className="mt-1 text-sm leading-6">{conflict.description}</p></div>
                  <div className="flex flex-wrap items-center gap-2"><label htmlFor={`contradiction-status-${conflict.id}`} className="text-xs text-muted-foreground">Investigator status</label><select id={`contradiction-status-${conflict.id}`} value={conflict.status} disabled={pending} onChange={(event) => doAction(() => updateContradictionStatus(bundle.case.id, conflict.id, event.target.value as 'unresolved' | 'investigating' | 'explained' | 'resolved'))} className="h-8 rounded-md border bg-background px-2 text-xs"><option value="unresolved">Unresolved</option><option value="investigating">Investigating</option><option value="explained">Explained</option><option value="resolved">Resolved</option></select></div>
                </CardContent>
              </Card>
            })}
          </div>
        )}
      </section>

      <section id="changed" className="scroll-mt-6 flex flex-col gap-4">
        <SectionHeading title="What changed?" description="Follow the shift from earlier understanding to new evidence and the current investigation state." />
        {!bundle.updates.length ? <EmptyState title="No investigation updates yet" description="Analyze an evidence item to see the previous belief, what changed, and the resulting investigation impact." /> : (
          <div className="overflow-hidden rounded-lg border border-primary/20 bg-card shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-primary/[0.035] px-4 py-3 md:px-5">
              <div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Latest state change</p><h3 className="mt-1 text-base font-semibold tracking-tight">{bundle.updates[0].headline}</h3></div>
              <StatusPill tone="neutral">Investigation day {bundle.updates[0].investigationDay}</StatusPill>
            </div>
            <div className="grid gap-3 p-4 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch md:p-5">
              <ChangeStage label="BEFORE" title="Prior understanding" text={bundle.updates[0].whatChanged.previousBelief} tone="muted" />
              <span className="hidden items-center text-muted-foreground md:flex" aria-hidden="true"><ArrowRight className="size-4" /></span>
              <ChangeStage label="NEW EVIDENCE" title="What arrived" text={bundle.updates[0].whatChanged.newEvidence} tone="evidence" />
              <span className="hidden items-center text-muted-foreground md:flex" aria-hidden="true"><ArrowRight className="size-4" /></span>
              <ChangeStage label="AFTER" title="Current impact" text={`${bundle.updates[0].whatChanged.change} ${bundle.updates[0].whatChanged.impact}`} tone="outcome" />
            </div>
            <div className="grid gap-x-6 gap-y-5 border-t px-4 py-4 sm:grid-cols-2 lg:grid-cols-4 md:px-5">
              <ChangeList title="Supported" items={bundle.updates[0].whatChanged.supportedAssumptions} empty="No assumptions supported in this update." tone="supported" />
              <ChangeList title="Challenged" items={bundle.updates[0].whatChanged.challengedAssumptions} empty="No assumptions challenged in this update." tone="challenged" />
              <ChangeList title="New connections" items={bundle.updates[0].whatChanged.newConnections} empty="No new connections in this update." />
              <ChangeList title="Changed conclusions" items={bundle.updates[0].whatChanged.changedConclusions} empty="No conclusion changed in this update." />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t px-4 py-2.5 text-[11px] text-muted-foreground md:px-5">
              <span>Memory recall: {bundle.updates[0].memoryStatus.recall.status}</span><span>Memory retain: {bundle.updates[0].memoryStatus.retain.status}</span>
            </div>
          </div>
        )}
        {bundle.updates.length > 1 ? <details className="group rounded-lg border bg-card">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">Earlier investigation changes<span className="text-xs font-normal text-muted-foreground">{bundle.updates.length - 1} updates</span></summary>
          <ol className="divide-y border-t">
            {bundle.updates.slice(1).map((update) => <li key={update.id} className="grid gap-1 px-4 py-3 sm:grid-cols-[110px_1fr] sm:gap-4">
              <span className="text-xs text-muted-foreground">Day {update.investigationDay} · {update.memoryStatus.recall.status === 'ok' ? 'Memory recalled' : 'Local case context'}</span>
              <div><p className="text-sm font-medium">{update.headline}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{update.whatChanged.change}</p><p className="mt-1 text-xs leading-5">{update.whatChanged.newEvidence}</p></div>
            </li>)}
          </ol>
        </details> : null}
      </section>

      <section id="believe" className="scroll-mt-6 flex flex-col gap-4">
        <SectionHeading title="Why do we believe this?" description="Select a person, claim, or event to inspect its evidence basis. This is an evidence trace, not a guilt assessment." />
        <div className="grid gap-4 lg:grid-cols-[0.7fr_1.3fr]">
          <Card>
            <CardHeader><CardTitle>Investigation items</CardTitle><CardDescription>Choose the item to explain.</CardDescription></CardHeader>
            <CardContent className="flex flex-col gap-4">
              {bundle.people.length ? <EntityButtons title="People" items={bundle.people.map((item) => ({ id: String(item.id), label: item.name, kind: 'person' as const }))} selected={selection} onSelect={setSelection} /> : null}
              {bundle.claims.length ? <EntityButtons title="Claims" items={bundle.claims.map((item) => ({ id: String(item.id), label: item.statement, kind: 'claim' as const }))} selected={selection} onSelect={setSelection} /> : null}
              {bundle.events.length ? <EntityButtons title="Events" items={bundle.events.map((item) => ({ id: String(item.id), label: item.title, kind: 'event' as const }))} selected={selection} onSelect={setSelection} /> : null}
              {!bundle.people.length && !bundle.claims.length && !bundle.events.length ? <p className="text-sm text-muted-foreground">Analyze evidence to create explainable investigation entities.</p> : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><CircleHelp className="size-4" />WHY DO WE BELIEVE THIS?</CardTitle><CardDescription>{selectedLabel}</CardDescription></CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="grid gap-4 md:grid-cols-3">
                <EvidenceGroup title="Supporting evidence" items={supportingEvidence} empty="No supporting evidence linked yet." />
                <EvidenceGroup title="Contradicting evidence" items={challengingEvidence} empty="No contradicting evidence linked yet." challenged />
                <EvidenceGroup title="Related timeline context" items={relatedContextEvidence} empty="No additional timeline context linked." />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <FactList label="Related people" items={selectedPerson ? [selectedPerson.name] : selectedClaim?.relatedPeople ?? selectedEvent?.people ?? []} />
                <FactList label="Related timeline entries" items={relatedTimelineEntries} />
              </div>
              {selectedPerson ? <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold text-muted-foreground">Evidence Association Score</p><div className="mt-1 flex flex-wrap items-baseline gap-2"><p className="text-3xl font-semibold tabular-nums">{selectedPerson.score}<span className="text-base text-muted-foreground">/100</span></p><span className="text-xs text-muted-foreground">Previous {selectedPerson.previousScore}/100</span><span className={`text-xs font-semibold ${selectedPerson.score - selectedPerson.previousScore >= 0 ? 'text-supported-foreground' : 'text-challenged-foreground'}`}>{selectedPerson.score - selectedPerson.previousScore >= 0 ? '+' : ''}{selectedPerson.score - selectedPerson.previousScore}</span></div></div><span className="text-xs text-muted-foreground">Last updated: Day {lastUpdatedDay || '—'}</span></div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">Evidence connection strength: a summary of how current material links this person to investigated events. Not a determination of guilt.</p>
                {selectedScoreHistory.length ? <ul className="mt-3 flex flex-col gap-2">{selectedScoreHistory.map((entry) => <li key={entry.id} className="border-t pt-2"><div className="flex justify-between gap-2 text-xs"><span>Day {entry.investigationDay} · {bundle.evidence.find((item) => item.id === entry.evidenceId)?.title}</span><span className="font-semibold tabular-nums">{entry.score}/100 ({entry.delta >= 0 ? '+' : ''}{entry.delta})</span></div><p className="mt-1 text-[11px] text-muted-foreground">{entry.factors.map((factor) => `${factor.weight > 0 ? '+' : ''}${factor.weight} ${factor.label}: ${factor.explanation}`).join(' · ')}</p></li>)}</ul> : <p className="mt-3 text-xs text-muted-foreground">No score changes recorded yet.</p>}
              </div> : null}
              {selectedClaim ? <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">Claim status: {selectedClaim.status} · {selectedClaim.confidence}/100 support index · Last update Day {lastUpdatedDay || '—'}. This index summarizes listed supporting and challenging evidence and is not a probability.</p> : null}
              {bundle.unresolvedQuestions.length ? <FactList label="Unresolved questions" items={bundle.unresolvedQuestions} /> : null}
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="memory" className="scroll-mt-6 flex flex-col gap-4">
        <SectionHeading title="Investigation memory" description="Case-scoped evidence, claims, relationships, contradictions, and updates. Local demo records are process-local; Hindsight is queried separately only when configured." />
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><BookOpen className="size-4" />Retained case context</CardTitle><CardDescription>Derived from this case’s evidence, claims, relationships, contradictions, updates, and score history.</CardDescription></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <ChangeList title="Important claims" items={bundle.claims.map((claim) => `[${claim.status}] ${claim.statement}`)} empty="No claims retained yet." />
              <ChangeList title="Previous conclusions" items={bundle.updates.flatMap((update) => update.whatChanged.changedConclusions)} empty="No prior conclusions have changed." />
              <ChangeList title="Known relationships" items={bundle.relationships.map((relation) => `${relation.source} ${relation.kind} ${relation.target} — ${relation.description}`)} empty="No relationships extracted yet." />
              <ChangeList title="Contradictions" items={bundle.contradictions.map((item) => `${item.status}: ${item.description}`)} empty="No contradictions identified." tone="challenged" />
              <ChangeList title="Important events" items={bundle.events.map((event) => `Day ${event.investigationDay} · ${event.title} · ${event.timeLabel} · ${event.location}`)} empty="No events retained yet." />
              <ChangeList title="Investigation state changes" items={bundle.updates.map((update) => `Day ${update.investigationDay}: ${update.headline} — ${update.whatChanged.change}`)} empty="No state changes recorded." />
              <ChangeList title="Unresolved questions" items={bundle.unresolvedQuestions} empty="No open questions in the latest analyzed evidence." tone="challenged" />
            </CardContent>
          </Card>
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle className="flex items-center gap-2"><Activity className="size-4" />Hindsight memory</CardTitle><StatusPill tone={hindsight.status === 'connected' ? 'supported' : 'challenged'}>{hindsight.status === 'connected' ? 'CONNECTED' : hindsight.status === 'error' ? 'CONNECTION ERROR' : 'NOT CONFIGURED'}</StatusPill></div><CardDescription>{hindsight.status === 'connected' ? `Verified server connection${hindsight.apiVersion ? ` · API ${hindsight.apiVersion}` : ''}` : 'Remote service was not verified'}</CardDescription></CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">{hindsight.status === 'connected' ? hindsight.detail : hindsight.status === 'error' ? `${hindsight.detail} Local demo memory active — Hindsight connection unavailable.` : 'Local demo memory active — Hindsight connection unavailable.'}</p>
                {hindsight.status === 'connected' ? <>
                  <p className="break-all rounded bg-muted px-2 py-1 font-mono text-[10px] text-muted-foreground">Case bank · {hindsight.bankId}</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <MemoryMetric label="Memories in bank" value={hindsight.memoryCount} />
                    <MemoryMetric label="Retained this process" value={hindsight.metrics.retainedItems} />
                    <MemoryMetric label="Recalled this process" value={hindsight.metrics.recalledMemories} />
                    <MemoryMetric label="Reflections generated" value={hindsight.metrics.reflectionsGenerated} />
                  </div>
                  {hindsight.memories.length ? <ul className="flex max-h-80 flex-col gap-3 overflow-y-auto">{hindsight.memories.map((memory) => <li key={memory.id} className="rounded-md border p-3"><p className="whitespace-pre-wrap text-xs leading-5">{memory.text}</p><p className="mt-2 text-[10px] text-muted-foreground">{memory.type ?? 'Memory'}{memory.occurredAt ? ` · ${memory.occurredAt}` : ''}</p></li>)}</ul> : <p className="text-xs text-muted-foreground">This case’s Hindsight bank is connected and currently has no memories.</p>}
                </> : <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">No remote retain, recall, or reflect result is being presented as successful. The separate local case state and deterministic demo continue to work.</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Reflect over this case</CardTitle><CardDescription>Uses Hindsight reflection only when the service is configured.</CardDescription></CardHeader>
              <CardContent>
                <form onSubmit={submitReflection} className="flex flex-col gap-3"><Label htmlFor="memory-question">Question</Label><Input id="memory-question" value={reflection} onChange={(event) => setReflection(event.target.value)} maxLength={500} placeholder="How did the timeline understanding change?" /><Button variant="outline" disabled={pending || hindsight.status !== 'connected'}>Ask Hindsight to reflect</Button></form>
                {reflectionResult ? <div className="mt-3 rounded-md border bg-muted/30 p-3"><p className="whitespace-pre-wrap text-sm leading-6">{reflectionResult.text}</p><p className="mt-3 border-t pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Hindsight source memories · {reflectionResult.sources.length}</p>{reflectionResult.sources.length ? <ul className="mt-2 flex flex-col gap-2">{reflectionResult.sources.map((source, index) => <li key={source.id || index} className="border-l-2 border-primary/30 pl-2 text-xs leading-5 text-muted-foreground">{source.text}</li>)}</ul> : <p className="mt-1 text-xs text-muted-foreground">Hindsight returned no source memories for this reflection.</p>}</div> : null}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section id="scores" className="scroll-mt-6 flex flex-col gap-4">
        <SectionHeading title="Evidence Association Score history" description="Each point reflects one evidence-processing event, with fixed, explainable factors shown below." />
        {!bundle.people.length ? <EmptyState title="No score histories yet" description="Score histories appear only when evidence supports a person-to-event connection." /> : (
          <div className="grid gap-4 md:grid-cols-2">
            {bundle.people.map((person) => <ScoreHistoryCard key={person.id} person={person.name} score={person.score} entries={bundle.scoreHistory.filter((entry) => entry.personId === person.id).map((entry) => ({ ...entry, evidenceTitle: bundle.evidence.find((item) => item.id === entry.evidenceId)?.title ?? 'Evidence' }))} />)}
          </div>
        )}
      </section>
    </div>
  )
}

function Metric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return <div className="flex min-h-20 flex-col justify-center gap-0.5 px-3 py-2 sm:min-h-22 sm:px-4"><span className="text-xl font-semibold tabular-nums tracking-tight">{value}</span><span className="text-[11px] font-medium text-foreground">{label}</span><span className="text-[10px] text-muted-foreground">{detail}</span></div>
}

function MemoryMetric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-md border px-2.5 py-2"><p className="text-base font-semibold tabular-nums">{value}</p><p className="text-[10px] leading-4 text-muted-foreground">{label}</p></div>
}

function SignalCell({ label, value, detail, challenged = false }: { label: string; value: string; detail: string; challenged?: boolean }) {
  return <div className="bg-card px-4 py-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><p className={`mt-1 text-lg font-semibold tabular-nums ${challenged ? 'text-challenged-foreground' : 'text-foreground'}`}>{value}</p><p className="text-xs text-muted-foreground">{detail}</p></div>
}

function ChangeStage({ label, title, text, tone }: { label: string; title: string; text: string; tone: 'muted' | 'evidence' | 'outcome' }) {
  const styles = {
    muted: 'border-border bg-muted/35',
    evidence: 'border-primary/25 bg-primary/[0.045]',
    outcome: 'border-challenged/35 bg-challenged/5',
  }
  return <div className={`flex min-h-28 flex-col gap-2 rounded-md border p-3 ${styles[tone]}`}>
    <span className="text-[10px] font-bold tracking-[0.13em] text-muted-foreground">{label}</span>
    <h4 className="text-xs font-semibold">{title}</h4>
    <p className="text-xs leading-5 text-muted-foreground">{text}</p>
  </div>
}

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10)
}

function FactList({ label, items }: { label: string; items: string[] }) {
  return <div><p className="text-xs font-semibold text-muted-foreground">{label}</p>{items.length ? <ul className="mt-1 flex flex-col gap-1">{items.map((item, index) => <li key={`${item}-${index}`} className="text-xs leading-5">{item}</li>)}</ul> : <p className="mt-1 text-xs text-muted-foreground">Not identified</p>}</div>
}

function ChangeList({ title, items, empty = 'None recorded.', tone = 'neutral' }: { title: string; items: string[]; empty?: string; tone?: string }) {
  return <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>{items.length ? <ul className="mt-2 flex flex-col gap-1.5">{items.map((item, index) => <li key={`${item}-${index}`} className={`flex gap-2 text-sm leading-5 ${tone === 'challenged' ? 'text-challenged-foreground' : tone === 'supported' ? 'text-supported-foreground' : ''}`}><span aria-hidden="true">{tone === 'challenged' ? '⚠' : tone === 'supported' ? '✓' : '•'}</span><span>{item}</span></li>)}</ul> : <p className="mt-2 text-xs text-muted-foreground">{empty}</p>}</div>
}

function EvidenceCompare({ label, evidence }: { label: string; evidence?: CaseBundle['evidence'][number] }) {
  return <div className="rounded-md border bg-muted/30 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>{evidence ? <><p className="mt-1 text-xs text-muted-foreground">Day {evidence.investigationDay} · {evidence.evidenceType} · <EvidenceRef id={evidence.id} /></p><p className="mt-1 font-medium">{evidence.title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{evidence.analysis?.summary ?? evidence.content}</p></> : <p className="mt-2 text-xs text-muted-foreground">Linked evidence is unavailable.</p>}</div>
}

function EvidenceGroup({ title, items, empty, challenged = false }: { title: string; items: CaseBundle['evidence']; empty: string; challenged?: boolean }) {
  return <div><p className={`text-xs font-semibold uppercase tracking-wide ${challenged ? 'text-challenged-foreground' : 'text-muted-foreground'}`}>{title}</p>{items.length ? <ul className="mt-2 flex flex-col gap-2">{items.map((item) => <li key={item.id} className="rounded-md border p-3"><div className="flex items-center gap-2"><EvidenceRef id={item.id} /><span className="text-xs text-muted-foreground">Day {item.investigationDay}</span></div><p className="mt-1 text-sm font-medium">{item.title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{item.analysis?.summary ?? item.content}</p></li>)}</ul> : <p className="mt-2 text-xs text-muted-foreground">{empty}</p>}</div>
}

function EntityButtons({ title, items, selected, onSelect }: { title: string; items: { kind: 'person' | 'claim' | 'event'; id: string; label: string }[]; selected: Selection; onSelect: (selection: Selection) => void }) {
  return <div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p><div className="flex max-h-52 flex-col gap-1 overflow-y-auto">{items.map((item) => <button key={item.id} type="button" onClick={() => onSelect({ kind: item.kind, id: item.id })} className={`rounded-md px-2.5 py-2 text-left text-xs leading-5 ${selected?.kind === item.kind && selected.id === item.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>{item.label}</button>)}</div></div>
}

function ScoreHistoryCard({ person, score, entries }: { person: string; score: number; entries: (CaseBundle['scoreHistory'][number] & { evidenceTitle: string })[] }) {
  const chartEntries = entries.length ? entries : []
  const points = chartEntries.map((entry, index) => {
    const x = chartEntries.length === 1 ? 50 : 8 + index * (84 / (chartEntries.length - 1))
    const y = 86 - entry.score * 0.68
    return `${x},${y}`
  }).join(' ')
  return <Card>
    <CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle>{person}</CardTitle><CardDescription>Evidence Association Score · evidence connection strength</CardDescription></div><span className="text-xl font-semibold tabular-nums">{score}/100</span></div></CardHeader>
    <CardContent className="flex flex-col gap-3">
      {entries.length ? <>
        <div className="h-36 rounded-md bg-muted/30 p-2"><svg role="img" aria-label={`${person} score history from ${entries[0].score} to ${entries.at(-1)?.score}`} viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full"><line x1="5" y1="18" x2="95" y2="18" stroke="currentColor" className="text-border" strokeDasharray="2 2" /><line x1="5" y1="52" x2="95" y2="52" stroke="currentColor" className="text-border" strokeDasharray="2 2" /><line x1="5" y1="86" x2="95" y2="86" stroke="currentColor" className="text-border" strokeDasharray="2 2" /><polyline fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" className="text-primary" points={points} />{chartEntries.map((entry, index) => { const x = chartEntries.length === 1 ? 50 : 8 + index * (84 / (chartEntries.length - 1)); const y = 86 - entry.score * 0.68; return <circle key={entry.id} cx={x} cy={y} r="2.1" fill="currentColor" className="text-primary"><title>{`Day ${entry.investigationDay}: ${entry.score}/100 after ${entry.evidenceTitle}`}</title></circle> })}</svg></div>
        <ol className="flex flex-col gap-2">{entries.map((entry) => <li key={entry.id} className="flex items-start justify-between gap-3 border-t pt-2 text-xs"><span><span className="font-semibold tabular-nums">Day {entry.investigationDay}: {entry.score}/100</span><span className="block text-muted-foreground">{entry.evidenceTitle}</span>{entry.factors.map((factor, index) => <span key={`${factor.factor}-${index}`} title={factor.explanation} className="mt-1 mr-1 inline-flex rounded bg-muted px-1.5 py-0.5">{factor.weight > 0 ? '+' : ''}{factor.weight} {factor.label}</span>)}</span><span className="shrink-0 font-medium tabular-nums">{entry.delta >= 0 ? '+' : ''}{entry.delta}</span></li>)}</ol>
      </> : <p className="text-sm text-muted-foreground">No score events yet. A score is recorded when evidence establishes a defined association factor.</p>}
    </CardContent>
  </Card>
}
