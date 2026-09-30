'use server'

import { and, asc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { cases, contradictions, evidence, investigationUpdates } from '@/lib/db/schema'
import { processEvidence } from '@/lib/agent/investigate'
import { DEMO_CASES } from '@/lib/demo/cases'
import { bankIdForCase, deleteCaseBank, reflectOnCase, retainCaseMemories, recallCaseMemories } from '@/lib/memory/hindsight'
import { buildCaseMemoryItems } from '@/lib/memory/case-facts'
import { deleteCaseDerivedState } from '@/lib/queries'
import { EVIDENCE_TYPES } from '@/lib/types'
import { isDatabaseDataMode } from '@/lib/data/mode'
import { requireSession } from '@/lib/auth/session'
import {
  addDemoEvidence,
  attachDemoMemoryOperations,
  createDemoCase,
  getDemoCaseBundle,
  peekNextDemoEvidence,
  processNextDemoEvidence,
  resetDemoCaseLocal,
  retryDemoEvidenceLocal,
  setDemoContradictionStatus,
} from '@/lib/data/demo-provider'

type ActionResult = { ok: true; message: string; caseId?: number } | { ok: false; error: string }

const caseSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(120),
  description: z.string().trim().max(1000).default(''),
})

export async function createCase(input: { title: string; description: string }): Promise<ActionResult> {
  await requireSession()
  const parsed = caseSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  if (!isDatabaseDataMode()) {
    const caseId = createDemoCase(parsed.data.title, parsed.data.description)
    revalidatePath('/')
    revalidatePath('/cases')
    return { ok: true, message: 'Local demo case created. Data lasts for this server process.', caseId }
  }
  const base = parsed.data.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  const slug = `${base || 'case'}-${Date.now().toString(36)}`
  const [created] = await db
    .insert(cases)
    .values({ slug, title: parsed.data.title, description: parsed.data.description })
    .returning()
  revalidatePath('/')
  revalidatePath('/cases')
  return { ok: true, message: 'Case created', caseId: created.id }
}

const evidenceSchema = z.object({
  caseId: z.number().int().positive(),
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(160),
  evidenceType: z.enum(EVIDENCE_TYPES),
  content: z.string().trim().min(10, 'Evidence text must be at least 10 characters').max(6000),
  investigationDay: z.number().int().min(1).max(365),
})

export async function addEvidence(input: z.input<typeof evidenceSchema>): Promise<ActionResult> {
  await requireSession()
  const parsed = evidenceSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  if (!isDatabaseDataMode()) {
    try {
      const caseBundle = getDemoCaseBundle(parsed.data.caseId)
      if (!caseBundle) return { ok: false, error: 'Case not found.' }
      const bankId = bankIdForCase(caseBundle.case.id)
      const recall = await recallCaseMemories(
        caseBundle.case.id,
        caseBundle.case.title,
        `What prior case memories concern this new evidence? ${parsed.data.title}. ${parsed.data.content}`.slice(0, 1800),
      )
      const added = addDemoEvidence(parsed.data, { bankId, recall: recall.op, memories: recall.memories })
      const updatedBundle = getDemoCaseBundle(parsed.data.caseId)
      const retain = updatedBundle
        ? await retainCaseMemories(parsed.data.caseId, updatedBundle.case.title, buildCaseMemoryItems(updatedBundle, added.evidenceId))
        : { status: 'skipped' as const, detail: 'Case not available for memory retention.' }
      attachDemoMemoryOperations(parsed.data.caseId, added.evidenceId, bankId, recall.op, retain)
      revalidatePath(`/cases/${parsed.data.caseId}`)
      revalidatePath('/')
      return { ok: true, message: `${added.headline} · Hindsight retain: ${retain.status}; recall: ${recall.op.status}.` }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Evidence analysis failed.' }
    }
  }
  const [caseRow] = await db.select({ id: cases.id }).from(cases).where(eq(cases.id, parsed.data.caseId))
  if (!caseRow) return { ok: false, error: 'Case not found.' }
  const [item] = await db
    .insert(evidence)
    .values({ ...parsed.data, status: 'pending' })
    .returning()
  const result = await processEvidence(item.id)
  revalidatePath(`/cases/${parsed.data.caseId}`)
  revalidatePath('/')
  if (!result.ok) return { ok: false, error: `Evidence saved but analysis failed: ${result.error}` }
  return { ok: true, message: result.headline }
}

export async function runDemoStep(caseId: number): Promise<ActionResult & { remaining?: number }> {
  await requireSession()
  if (!isDatabaseDataMode()) {
    const bundle = getDemoCaseBundle(caseId)
    const nextEvidence = peekNextDemoEvidence(caseId)
    if (!bundle) return { ok: false, error: 'Case not found.' }
    if (!nextEvidence) return { ok: false, error: 'All demo evidence has already been processed.' }
    const bankId = bankIdForCase(caseId)
    const recall = await recallCaseMemories(
      caseId,
      bundle.case.title,
      `What does this investigation already remember that is relevant to Day ${nextEvidence.investigationDay} evidence “${nextEvidence.title}”? ${nextEvidence.content}`.slice(0, 1800),
    )
    const result = processNextDemoEvidence(caseId, { bankId, recall: recall.op, memories: recall.memories })
    if (!result) return { ok: false, error: getDemoCaseBundle(caseId) ? 'All demo evidence has already been processed.' : 'Case not found.' }
    const updatedBundle = getDemoCaseBundle(caseId)
    const retain = updatedBundle
      ? await retainCaseMemories(caseId, updatedBundle.case.title, buildCaseMemoryItems(updatedBundle, result.evidenceId))
      : { status: 'skipped' as const, detail: 'Case not available for memory retention.' }
    attachDemoMemoryOperations(caseId, result.evidenceId, bankId, recall.op, retain)
    revalidatePath(`/cases/${caseId}`)
    revalidatePath('/')
    return { ok: true, message: `${result.headline} · Hindsight retain: ${retain.status}; recall: ${recall.op.status}.`, remaining: result.remaining }
  }
  const queued = await db
    .select()
    .from(evidence)
    .where(and(eq(evidence.caseId, caseId), eq(evidence.status, 'queued')))
    .orderBy(asc(evidence.investigationDay), asc(evidence.id))
  const next = queued[0]
  if (!next) return { ok: false, error: 'All demo evidence has already been processed.' }
  const result = await processEvidence(next.id)
  revalidatePath(`/cases/${caseId}`)
  revalidatePath('/')
  if (!result.ok) {
    await db.update(evidence).set({ status: 'queued' }).where(eq(evidence.id, next.id))
    return { ok: false, error: result.error }
  }
  return { ok: true, message: `Day ${next.investigationDay}: ${result.headline}`, remaining: queued.length - 1 }
}

export async function retryEvidence(evidenceId: number): Promise<ActionResult> {
  await requireSession()
  if (!isDatabaseDataMode()) {
    const result = retryDemoEvidenceLocal(evidenceId)
    if (!result) return { ok: false, error: 'Evidence not found in the local demo data.' }
    revalidatePath(`/cases/${result.caseId}`)
    return { ok: true, message: result.message }
  }
  const result = await processEvidence(evidenceId)
  const [row] = await db.select({ caseId: evidence.caseId }).from(evidence).where(eq(evidence.id, evidenceId))
  if (row) revalidatePath(`/cases/${row.caseId}`)
  if (!result.ok) return { ok: false, error: result.error }
  return { ok: true, message: result.headline }
}

export async function resetDemoCase(caseId: number): Promise<ActionResult> {
  await requireSession()
  if (!isDatabaseDataMode()) {
    if (!resetDemoCaseLocal(caseId)) return { ok: false, error: 'Only preloaded demo cases can be reset.' }
    const bundle = getDemoCaseBundle(caseId)
    const bank = bundle ? await deleteCaseBank(bundle.case.id) : { detail: 'No remote Hindsight bank was changed.' }
    revalidatePath(`/cases/${caseId}`)
    revalidatePath('/')
    return { ok: true, message: `Demo case reset. ${bank.detail}` }
  }
  const [caseRow] = await db.select().from(cases).where(eq(cases.id, caseId))
  const demo = DEMO_CASES.find((d) => d.slug === caseRow?.slug)
  if (!caseRow || !caseRow.isDemo || !demo) return { ok: false, error: 'Only demo cases can be reset.' }

  await deleteCaseDerivedState(caseId)
  await db.delete(evidence).where(eq(evidence.caseId, caseId))
  await db.insert(evidence).values(
    demo.evidence.map((e) => ({
      caseId,
      title: e.title,
      evidenceType: e.type,
      content: e.content,
      investigationDay: e.day,
      status: 'queued',
    })),
  )
  await db.update(cases).set({ summary: '', updatedAt: new Date() }).where(eq(cases.id, caseId))
  const bank = await deleteCaseBank(caseRow.id)

  revalidatePath(`/cases/${caseId}`)
  revalidatePath('/')
  return { ok: true, message: `Demo reset. ${bank.detail}` }
}

export async function reflectOnInvestigation(caseId: number, question: string) {
  await requireSession()
  const q = question.trim().slice(0, 500)
  if (!q) return { ok: false as const, error: 'Enter a question.' }
  if (!isDatabaseDataMode()) {
    const bundle = getDemoCaseBundle(caseId)
    if (!bundle) return { ok: false as const, error: 'Case not found' }
    const res = await reflectOnCase(bundle.case.id, bundle.case.title, q)
    if (res.op.status !== 'ok') return { ok: false as const, error: res.op.detail }
    return { ok: true as const, text: res.text, sources: res.sources }
  }
  const [caseRow] = await db.select().from(cases).where(eq(cases.id, caseId))
  if (!caseRow) return { ok: false as const, error: 'Case not found' }
  const res = await reflectOnCase(caseRow.id, caseRow.title, q)
  if (res.op.status !== 'ok') return { ok: false as const, error: res.op.detail }
  return { ok: true as const, text: res.text, sources: res.sources }
}

export async function updateContradictionStatus(
  caseId: number,
  contradictionId: number,
  status: 'unresolved' | 'investigating' | 'explained' | 'resolved',
): Promise<ActionResult> {
  await requireSession()
  const parsed = z.object({
    caseId: z.number().int().positive(),
    contradictionId: z.number().int().positive(),
    status: z.enum(['unresolved', 'investigating', 'explained', 'resolved']),
  }).safeParse({ caseId, contradictionId, status })
  if (!parsed.success) return { ok: false, error: 'Invalid contradiction update.' }
  if (!isDatabaseDataMode()) {
    const updated = setDemoContradictionStatus(parsed.data.caseId, parsed.data.contradictionId, parsed.data.status)
    if (!updated) return { ok: false, error: 'Contradiction not found in this case.' }
    const bundle = getDemoCaseBundle(parsed.data.caseId)
    const conflict = bundle?.contradictions.find((item) => item.id === parsed.data.contradictionId)
    const bankId = bankIdForCase(parsed.data.caseId)
    const retain = conflict && bundle
      ? await retainCaseMemories(parsed.data.caseId, bundle.case.title, [{
          content: `Investigator changed contradiction C${conflict.id} status to ${parsed.data.status}. Conflicting evidence remains: ${conflict.description}. This status change is not a finding about source truthfulness.`,
          context: `CASEMIND investigator update, Day ${conflict.investigationDay}`,
          documentId: `casemind-case-${parsed.data.caseId}-contradiction-${conflict.id}-status`,
          tags: [`case:${parsed.data.caseId}`, `day:${conflict.investigationDay}`, 'investigator-context'],
          timestamp: new Date(),
        }])
      : { status: 'skipped' as const, detail: 'Contradiction was not available for memory retention.' }
    if (conflict) attachDemoMemoryOperations(parsed.data.caseId, conflict.evidenceId, bankId, { status: 'skipped', detail: 'No recall required for a status-only investigator update.' }, retain)
    revalidatePath(`/cases/${parsed.data.caseId}`)
    revalidatePath('/')
    return { ok: true, message: `Contradiction marked ${parsed.data.status} in local demo data. Hindsight retain: ${retain.status}.` }
  }
  const [current] = await db.select().from(contradictions).where(and(
    eq(contradictions.id, parsed.data.contradictionId),
    eq(contradictions.caseId, parsed.data.caseId),
  ))
  if (!current) return { ok: false, error: 'Contradiction not found in this case.' }
  if (current.status === parsed.data.status) return { ok: true, message: 'Contradiction status is unchanged.' }

  await db.update(contradictions).set({ status: parsed.data.status }).where(and(
    eq(contradictions.id, parsed.data.contradictionId),
    eq(contradictions.caseId, parsed.data.caseId),
  ))
  const [caseRow] = await db.select().from(cases).where(eq(cases.id, parsed.data.caseId))
  const bankId = caseRow ? bankIdForCase(caseRow.id) : ''
  const retain = caseRow
    ? await retainCaseMemories(parsed.data.caseId, caseRow.title, [{
        content: `Investigator changed contradiction C${current.id} status from ${current.status} to ${parsed.data.status}. Conflict: ${current.description}. This is a status update, not a finding about source truthfulness.`,
        context: `CASEMIND investigator status change, investigation day ${current.investigationDay}`,
        documentId: `contradiction-${current.id}-status-${Date.now()}`,
        tags: [`case:${caseRow.slug}`, `day:${current.investigationDay}`, 'investigator-context'],
      }])
    : { status: 'skipped' as const, detail: 'Case not available for memory retention.' }

  await db.insert(investigationUpdates).values({
    caseId: current.caseId,
    evidenceId: current.evidenceId,
    investigationDay: current.investigationDay,
    headline: `Contradiction marked ${parsed.data.status}`,
    whatChanged: {
      newEvidence: 'Investigator updated a contradiction status.',
      previousBelief: `Contradiction status was ${current.status}.`,
      change: `Status changed from ${current.status} to ${parsed.data.status}.`,
      impact: 'The investigator updated the review state; CASEMIND made no determination about source truthfulness.',
      supportedAssumptions: [],
      challengedAssumptions: [current.description],
      newConnections: [],
      changedConclusions: [],
      affectedPeople: [],
      recalledContext: [],
    },
    recalledMemories: [],
    memoryStatus: {
      bankId,
      recall: { status: 'skipped', detail: 'No recall required for a status-only investigator update.' },
      retain,
    },
  })
  if (caseRow) await db.update(cases).set({ updatedAt: new Date() }).where(eq(cases.id, caseRow.id))
  revalidatePath(`/cases/${parsed.data.caseId}`)
  revalidatePath('/')
  return { ok: true, message: `Contradiction marked ${parsed.data.status}.` }
}
