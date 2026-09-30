import { and, asc, eq, ne } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  cases,
  claims,
  contradictions,
  events,
  evidence,
  investigationUpdates,
  people,
  relationships,
  scoreHistory,
  type AppliedFactor,
  type Claim,
  type Person,
} from '@/lib/db/schema'
import { bankIdForCase, recallCaseMemories, retainCaseMemories, isHindsightConfigured } from '@/lib/memory/hindsight'
import type { RetainItem } from '@/lib/memory/hindsight'
import { analyzeEvidence, type AgentAnalysis } from './analyze'
import { BASELINE_SCORE, SCORE_FACTORS, clampScore, claimSupport } from './scoring'
import type { MemoryStatus, WhatChanged } from '@/lib/types'

/**
 * Investigation agent pipeline for one evidence item:
 * recall (Hindsight) → analyse (LLM) → update structured state → retain (Hindsight).
 */
export async function processEvidence(evidenceId: number) {
  const [item] = await db.select().from(evidence).where(eq(evidence.id, evidenceId))
  if (!item) throw new Error('Evidence not found')
  const [caseRow] = await db.select().from(cases).where(eq(cases.id, item.caseId))
  if (!caseRow) throw new Error('Case not found')

  await db.update(evidence).set({ status: 'processing', error: null }).where(eq(evidence.id, item.id))

  try {
    const [priorEvidence, caseClaims, casePeople, caseEvents] = await Promise.all([
      db
        .select()
        .from(evidence)
        .where(and(eq(evidence.caseId, caseRow.id), eq(evidence.status, 'analyzed'), ne(evidence.id, item.id)))
        .orderBy(asc(evidence.investigationDay), asc(evidence.id)),
      db.select().from(claims).where(eq(claims.caseId, caseRow.id)).orderBy(asc(claims.id)),
      db.select().from(people).where(eq(people.caseId, caseRow.id)),
      db.select().from(events).where(eq(events.caseId, caseRow.id)).orderBy(asc(events.investigationDay)),
    ])

    const bankId = bankIdForCase(caseRow.id)
    const recall = await recallCaseMemories(
      caseRow.id,
      caseRow.title,
      `What does the investigation already know that relates to this new evidence? ${item.title}. ${item.content}`.slice(0, 1500),
    )

    const analysis = await analyzeEvidence({
      caseTitle: caseRow.title,
      caseDescription: caseRow.description,
      currentSummary: caseRow.summary,
      newEvidence: {
        id: item.id,
        title: item.title,
        type: item.evidenceType,
        day: item.investigationDay,
        content: item.content,
      },
      priorEvidence: priorEvidence.map((e) => ({
        id: e.id,
        title: e.title,
        type: e.evidenceType,
        day: e.investigationDay,
        summary: e.analysis?.summary || e.content,
      })),
      claims: caseClaims.map((c) => ({
        id: c.id,
        statement: c.statement,
        status: c.status,
        supporting: c.supportingEvidenceIds,
        contradicting: c.contradictingEvidenceIds,
      })),
      people: casePeople.map((p) => ({ name: p.name, role: p.role, score: p.score })),
      events: caseEvents.map((e) => ({
        title: e.title,
        timeLabel: e.timeLabel,
        location: e.location,
        day: e.investigationDay,
      })),
      recalledMemories: recall.memories,
      memoryAvailable: recall.op.status === 'ok',
    })

    const priorIds = new Set(priorEvidence.map((e) => e.id))
    const day = item.investigationDay

    const peopleResult = await applyPeopleAndScores(caseRow.id, item.id, day, casePeople, analysis)
    const affectedClaimIds = await applyClaims(caseRow.id, item.id, day, caseClaims, analysis)

    const validContradictions = analysis.contradictions.filter((c) => priorIds.has(c.conflictingEvidenceId))
    const claimIds = new Set(caseClaims.map((c) => c.id))
    if (validContradictions.length) {
      await db.insert(contradictions).values(
        validContradictions.map((c) => ({
          caseId: caseRow.id,
          evidenceId: item.id,
          conflictingEvidenceId: c.conflictingEvidenceId,
          claimId: c.claimId && claimIds.has(c.claimId) ? c.claimId : null,
          kind: c.kind,
          description: c.description,
          status: 'unresolved',
          investigationDay: day,
        })),
      )
    }

    if (/corrected the transfer entry/i.test(item.content)) {
      const movementRecord = priorEvidence.find((prior) => /movement report/i.test(prior.title))
      if (movementRecord) {
        await db
          .update(contradictions)
          .set({ status: 'explained' })
          .where(and(
            eq(contradictions.caseId, caseRow.id),
            eq(contradictions.kind, 'time'),
            eq(contradictions.conflictingEvidenceId, movementRecord.id),
          ))
      }
    }

    if (analysis.events.length) {
      await db.insert(events).values(
        analysis.events.map((e) => ({
          caseId: caseRow.id,
          evidenceId: item.id,
          title: e.title,
          description: e.description,
          timeLabel: e.timeLabel,
          sortMinutes: e.sortMinutes,
          location: e.location,
          people: e.people,
          investigationDay: day,
        })),
      )
    }

    if (analysis.relationships.length) {
      await db.insert(relationships).values(
        analysis.relationships.map((r) => ({
          caseId: caseRow.id,
          evidenceId: item.id,
          source: r.source,
          target: r.target,
          kind: r.kind,
          description: r.description,
          investigationDay: day,
        })),
      )
    }

    await db
      .update(evidence)
      .set({
        status: 'analyzed',
        processedAt: new Date(),
        analysis: {
          analysisMode: analysis.analysisMode,
          summary: analysis.summary,
          findings: analysis.findings,
          locations: analysis.locations,
          times: analysis.times,
          peopleMentioned: analysis.people.map((p) => p.name),
          affectedClaimIds,
          unresolvedQuestions: analysis.unresolvedQuestions,
          hypotheses: analysis.hypotheses,
        },
      })
      .where(eq(evidence.id, item.id))

    await db
      .update(cases)
      .set({ summary: analysis.caseSummary, updatedAt: new Date() })
      .where(eq(cases.id, caseRow.id))

    const retain = await retainCaseMemories(
      caseRow.id,
      caseRow.title,
      buildRetainItems(caseRow.id, item, analysis, peopleResult, validContradictions.length),
    )

    const whatChanged: WhatChanged = {
      newEvidence: `Day ${day} · ${item.evidenceType}: ${analysis.summary}`,
      previousBelief: analysis.whatChanged.previousBelief,
      change: [
        analysis.whatChanged.change,
        ...peopleResult.map((person) => `Evidence Association Score: ${person.name} ${person.score - person.delta} → ${person.score}/100 (${person.delta >= 0 ? '+' : ''}${person.delta}).`),
      ].join(' '),
      impact: analysis.whatChanged.impact,
      supportedAssumptions: analysis.whatChanged.supportedAssumptions,
      challengedAssumptions: analysis.whatChanged.challengedAssumptions,
      newConnections: analysis.whatChanged.newConnections,
      changedConclusions: analysis.whatChanged.changedConclusions,
      affectedPeople: analysis.whatChanged.affectedPeople,
      recalledContext: analysis.whatChanged.recalledContext,
    }

    const memoryStatus: MemoryStatus = { bankId, recall: recall.op, retain }

    await db.insert(investigationUpdates).values({
      caseId: caseRow.id,
      evidenceId: item.id,
      investigationDay: day,
      headline: analysis.headline,
      whatChanged,
      recalledMemories: recall.memories,
      memoryStatus,
    })

    return { ok: true as const, headline: analysis.headline, memoryStatus }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[casemind] evidence processing failed', message)
    await db.update(evidence).set({ status: 'failed', error: message }).where(eq(evidence.id, item.id))
    return { ok: false as const, error: message }
  }
}

type PeopleResult = { name: string; score: number; delta: number; factors: AppliedFactor[] }[]

async function applyPeopleAndScores(
  caseId: number,
  evidenceId: number,
  day: number,
  existing: Person[],
  analysis: AgentAnalysis,
): Promise<PeopleResult> {
  const byName = new Map(existing.map((p) => [p.name.toLowerCase(), p]))
  const roles = new Map(analysis.people.map((p) => [p.name.toLowerCase(), p]))
  const names = new Set<string>([
    ...analysis.people.map((p) => p.name),
    ...analysis.scoreFactors.map((f) => f.person),
  ])

  const results: PeopleResult = []

  for (const name of names) {
    const key = name.toLowerCase()
    let person = byName.get(key)
    const applied: AppliedFactor[] = []
    let startScore = person?.score ?? 0

    if (!person) {
      const [created] = await db
        .insert(people)
        .values({
          caseId,
          name,
          role: roles.get(key)?.role ?? '',
          score: BASELINE_SCORE,
          previousScore: 0,
        })
        .onConflictDoNothing()
        .returning()
      if (!created) continue
      person = created
      byName.set(key, created)
      startScore = 0
      applied.push({
        factor: 'baseline',
        label: 'First connected to the case',
        weight: BASELINE_SCORE,
        explanation: 'Baseline assigned when a person first appears in case evidence.',
      })
    }

    for (const f of analysis.scoreFactors.filter((sf) => sf.person.toLowerCase() === key)) {
      const def = SCORE_FACTORS[f.factor]
      applied.push({ factor: f.factor, label: def.label, weight: def.weight, explanation: f.explanation })
    }

    if (!applied.length) continue

    const delta = applied.reduce((sum, f) => sum + f.weight, 0)
    const newScore = clampScore(startScore + delta)
    const actualDelta = newScore - startScore
    const role = roles.get(key)?.role || person.role

    await db
      .update(people)
      .set({ score: newScore, previousScore: startScore, role, updatedAt: new Date() })
      .where(eq(people.id, person.id))

    await db.insert(scoreHistory).values({
      caseId,
      personId: person.id,
      evidenceId,
      investigationDay: day,
      score: newScore,
      delta: actualDelta,
      factors: applied,
    })

    results.push({ name: person.name, score: newScore, delta: actualDelta, factors: applied })
  }

  return results
}

async function applyClaims(
  caseId: number,
  evidenceId: number,
  day: number,
  existing: Claim[],
  analysis: AgentAnalysis,
) {
  const byId = new Map(existing.map((c) => [c.id, c]))
  const affected: number[] = []

  for (const update of analysis.claimUpdates) {
    const current = update.existingClaimId ? byId.get(update.existingClaimId) : undefined

    if (current) {
      const supporting = new Set(current.supportingEvidenceIds)
      const contradicting = new Set(current.contradictingEvidenceIds)
      if (update.relation === 'supports') {
        supporting.add(evidenceId)
        contradicting.delete(evidenceId)
      } else {
        contradicting.add(evidenceId)
        supporting.delete(evidenceId)
      }
      const { confidence, status } = claimSupport(supporting.size, contradicting.size)
      const next = {
        supportingEvidenceIds: [...supporting],
        contradictingEvidenceIds: [...contradicting],
        relatedPeople: [...new Set([...current.relatedPeople, ...update.relatedPeople])],
        relatedEvents: [...new Set([...current.relatedEvents, ...update.relatedEvents])],
        confidence,
        status,
        lastUpdatedDay: day,
        updatedAt: new Date(),
      }
      await db.update(claims).set(next).where(eq(claims.id, current.id))
      byId.set(current.id, { ...current, ...next })
      affected.push(current.id)
    } else {
      const supporting = update.relation === 'supports' ? [evidenceId] : []
      const contradicting = update.relation === 'contradicts' ? [evidenceId] : []
      const { confidence, status } = claimSupport(supporting.length, contradicting.length)
      const [created] = await db
        .insert(claims)
        .values({
          caseId,
          statement: update.statement,
          status,
          confidence,
          supportingEvidenceIds: supporting,
          contradictingEvidenceIds: contradicting,
          relatedPeople: update.relatedPeople,
          relatedEvents: update.relatedEvents,
          lastUpdatedDay: day,
        })
        .returning()
      byId.set(created.id, created)
      affected.push(created.id)
    }
  }

  return affected
}

function buildRetainItems(
  caseId: number,
  item: { id: number; title: string; evidenceType: string; investigationDay: number; content: string },
  analysis: AgentAnalysis,
  peopleResult: PeopleResult,
  contradictionCount: number,
) {
  const day = item.investigationDay
  const tags = [`case:${caseId}`, `day:${day}`, `evidence:${item.id}`]
  const context = `CASEMIND case ${caseId}, investigation Day ${day}, evidence E${item.id}`
  const items: RetainItem[] = []
  const add = (kind: string, index: number, content: string) => items.push({
    content,
    context,
    documentId: `casemind-case-${caseId}-evidence-${item.id}-${kind}-${index}`,
    tags,
  })

  add('source', 0, `Day ${day}, evidence E${item.id} (${item.evidenceType}), source “${item.title}”: ${item.content}`)
  analysis.findings.forEach((finding, index) => add('fact', index, `Day ${day}, E${item.id} finding from ${item.title}: ${finding}`))
  analysis.times.forEach((time, index) => add('time', index, `Day ${day}, E${item.id} (${item.title}) reports time ${time}.`))
  analysis.locations.forEach((location, index) => add('location', index, `Day ${day}, E${item.id} (${item.title}) refers to ${location}.`))
  analysis.people.forEach((person, index) => add('person', index, `Day ${day}, E${item.id} (${item.title}) mentions ${person.name} in context: ${person.role || 'role not specified'}. This is a source association, not a conclusion about responsibility.`))
  analysis.events.forEach((event, index) => add('event', index, `Day ${day} event “${event.title}”: ${event.description} Time: ${event.timeLabel}. Location: ${event.location || 'not stated'}. People: ${event.people.join(', ') || 'none identified'}.`))
  analysis.claimUpdates.forEach((claim, index) => add('claim', index, `Day ${day}, E${item.id} ${claim.relation} the claim “${claim.statement}”. Related people: ${claim.relatedPeople.join(', ') || 'none identified'}. Related events: ${claim.relatedEvents.join(', ') || 'none identified'}.`))
  analysis.relationships.forEach((relationship, index) => add('relationship', index, `Day ${day}, E${item.id} relationship: ${relationship.source} ${relationship.kind} ${relationship.target}. ${relationship.description}`))
  analysis.contradictions.forEach((conflict, index) => add('contradiction', index, `Day ${day}, E${conflict.conflictingEvidenceId} conflicts with E${item.id}: ${conflict.description} This is an unresolved source conflict; neither source is presumed truthful.`))
  analysis.whatChanged.supportedAssumptions.forEach((belief, index) => add('supported-assumption', index, `Day ${day}, previous assumption currently supported by E${item.id}: ${belief}`))
  analysis.whatChanged.challengedAssumptions.forEach((belief, index) => add('challenged-assumption', index, `Day ${day}, previous assumption challenged by E${item.id} and requiring investigator review: ${belief}`))
  analysis.whatChanged.newConnections.forEach((connection, index) => add('connection', index, `Day ${day}, E${item.id} creates or updates this investigation relationship: ${connection}`))
  analysis.whatChanged.changedConclusions.forEach((conclusion, index) => add('conclusion', index, `Day ${day}, investigation state changed: ${conclusion}`))
  analysis.unresolvedQuestions.forEach((question, index) => add('open-question', index, `Day ${day}, unresolved investigation question after E${item.id}: ${question}`))
  peopleResult.forEach((person, index) => add('score', index,
    `Day ${day}, E${item.id} changed ${person.name} Evidence Association Score to ${person.score}/100 (${person.delta >= 0 ? '+' : ''}${person.delta}). Factors: ${person.factors.map((factor) => `${factor.weight > 0 ? '+' : ''}${factor.weight} ${factor.label} — ${factor.explanation}`).join('; ')}. Score describes evidence connection strength, not guilt.`))
  add('state-change', 0, `Day ${day} investigation update: ${analysis.headline}. Previous understanding: ${analysis.whatChanged.previousBelief}. What changed: ${analysis.whatChanged.change}. Impact: ${analysis.whatChanged.impact}. ${contradictionCount ? `${contradictionCount} source contradiction(s) were added.` : ''}`)
  add('case-summary', 0, `Case ${caseId} current investigation summary after Day ${day}: ${analysis.caseSummary}`)
  return items
}

export { isHindsightConfigured }
