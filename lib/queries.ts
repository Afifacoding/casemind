import { asc, desc, eq, inArray } from 'drizzle-orm'
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
  type Case,
  type Contradiction,
  type Evidence,
} from '@/lib/db/schema'
import { DEMO_CASES } from '@/lib/demo/cases'
import { isDatabaseDataMode } from '@/lib/data/mode'
import { getDemoCaseBundle, getDemoDashboard, listDemoCases } from '@/lib/data/demo-provider'
import type { CaseBundle, CaseWithStats } from '@/lib/data/types'
export type { CaseBundle, CaseWithStats } from '@/lib/data/types'

let seeded = false

/** Preloads the synthetic demo cases with queued evidence the first time the app runs. */
async function ensureDatabaseDemoCases() {
  if (seeded) return
  const existing = await db.select({ slug: cases.slug }).from(cases)
  const slugs = new Set(existing.map((c) => c.slug))
  for (const demo of DEMO_CASES) {
    if (slugs.has(demo.slug)) continue
    const [created] = await db
      .insert(cases)
      .values({ slug: demo.slug, title: demo.title, description: demo.description, isDemo: true })
      .returning()
    await db.insert(evidence).values(
      demo.evidence.map((e) => ({
        caseId: created.id,
        title: e.title,
        evidenceType: e.type,
        content: e.content,
        investigationDay: e.day,
        status: 'queued',
      })),
    )
  }
  seeded = true
}

export function caseStatusLabel(analyzedCount: number, openContradictions: number) {
  if (analyzedCount === 0) return 'Awaiting evidence'
  if (openContradictions > 0) return 'Contradictions under review'
  return 'Active investigation'
}

export function latestUnresolved(caseEvidence: Evidence[]) {
  const analyzed = caseEvidence
    .filter((e) => e.status === 'analyzed' && e.analysis)
    .sort((a, b) => b.investigationDay - a.investigationDay || b.id - a.id)
  return analyzed[0]?.analysis?.unresolvedQuestions ?? []
}

async function getDatabaseCasesWithStats(): Promise<CaseWithStats[]> {
  await ensureDatabaseDemoCases()
  const [allCases, allEvidence, allPeople, allClaims, allContradictions] = await Promise.all([
    db.select().from(cases).orderBy(desc(cases.isDemo), asc(cases.id)),
    db.select().from(evidence),
    db.select({ id: people.id, caseId: people.caseId }).from(people),
    db.select({ id: claims.id, caseId: claims.caseId, status: claims.status }).from(claims),
    db.select().from(contradictions),
  ])

  return allCases.map((c) => {
    const ev = allEvidence.filter((e) => e.caseId === c.id)
    const analyzed = ev.filter((e) => e.status === 'analyzed').length
    const contra = allContradictions.filter((x) => x.caseId === c.id)
    const openContra = contra.filter((x) => !['explained', 'resolved'].includes(x.status))
    return {
      ...c,
      evidenceCount: analyzed,
      queuedCount: ev.filter((e) => e.status === 'queued').length,
      peopleCount: allPeople.filter((p) => p.caseId === c.id).length,
      claimCount: allClaims.filter((x) => x.caseId === c.id).length,
      contradictionCount: contra.length,
      unresolvedQuestions: latestUnresolved(ev),
      statusLabel: caseStatusLabel(analyzed, openContra.length),
    }
  })
}

async function getDatabaseDashboard() {
  const caseList = await getDatabaseCasesWithStats()
  const recentUpdates = await db
    .select({
      id: investigationUpdates.id,
      caseId: investigationUpdates.caseId,
      headline: investigationUpdates.headline,
      investigationDay: investigationUpdates.investigationDay,
      whatChanged: investigationUpdates.whatChanged,
      createdAt: investigationUpdates.createdAt,
    })
    .from(investigationUpdates)
    .orderBy(desc(investigationUpdates.createdAt))
    .limit(8)

  const titles = new Map(caseList.map((c) => [c.id, c.title]))
  return {
    cases: caseList,
    totals: {
      activeCases: caseList.length,
      evidence: caseList.reduce((s, c) => s + c.evidenceCount, 0),
      people: caseList.reduce((s, c) => s + c.peopleCount, 0),
      contradictions: caseList.reduce((s, c) => s + c.contradictionCount, 0),
      unresolved: caseList.reduce((s, c) => s + c.unresolvedQuestions.length, 0),
    },
    recentUpdates: recentUpdates.map((u) => ({ ...u, caseTitle: titles.get(u.caseId) ?? 'Case' })),
  }
}

async function getDatabaseCaseBundle(caseId: number): Promise<CaseBundle | null> {
  await ensureDatabaseDemoCases()
  const [caseRow] = await db.select().from(cases).where(eq(cases.id, caseId))
  if (!caseRow) return null

  const [caseEvidence, casePeople, caseClaims, caseEvents, caseRelationships, caseContradictions, updates, history] =
    await Promise.all([
      db
        .select()
        .from(evidence)
        .where(eq(evidence.caseId, caseId))
        .orderBy(asc(evidence.investigationDay), asc(evidence.id)),
      db.select().from(people).where(eq(people.caseId, caseId)).orderBy(desc(people.score)),
      db.select().from(claims).where(eq(claims.caseId, caseId)).orderBy(asc(claims.id)),
      db
        .select()
        .from(events)
        .where(eq(events.caseId, caseId))
        .orderBy(asc(events.investigationDay), asc(events.sortMinutes)),
      db.select().from(relationships).where(eq(relationships.caseId, caseId)).orderBy(asc(relationships.id)),
      db.select().from(contradictions).where(eq(contradictions.caseId, caseId)).orderBy(asc(contradictions.id)),
      db
        .select()
        .from(investigationUpdates)
        .where(eq(investigationUpdates.caseId, caseId))
        .orderBy(desc(investigationUpdates.investigationDay), desc(investigationUpdates.id)),
      db
        .select()
        .from(scoreHistory)
        .where(eq(scoreHistory.caseId, caseId))
        .orderBy(asc(scoreHistory.investigationDay), asc(scoreHistory.id)),
    ])

  const analyzed = caseEvidence.filter((e) => e.status === 'analyzed')
  return {
    case: caseRow as Case,
    evidence: caseEvidence,
    people: casePeople,
    claims: caseClaims,
    events: caseEvents,
    relationships: caseRelationships,
    contradictions: caseContradictions as Contradiction[],
    updates,
    scoreHistory: history,
    unresolvedQuestions: latestUnresolved(caseEvidence),
    hypotheses: analyzed.at(-1)?.analysis?.hypotheses ?? [],
    statusLabel: caseStatusLabel(
      analyzed.length,
      caseContradictions.filter((item) => !['explained', 'resolved'].includes(item.status)).length,
    ),
  }
}

export async function deleteCaseDerivedState(caseId: number) {
  await Promise.all([
    db.delete(people).where(eq(people.caseId, caseId)),
    db.delete(claims).where(eq(claims.caseId, caseId)),
    db.delete(events).where(eq(events.caseId, caseId)),
    db.delete(relationships).where(eq(relationships.caseId, caseId)),
    db.delete(contradictions).where(eq(contradictions.caseId, caseId)),
    db.delete(investigationUpdates).where(eq(investigationUpdates.caseId, caseId)),
    db.delete(scoreHistory).where(eq(scoreHistory.caseId, caseId)),
  ])
}

/** Persistent deployment adapter backed by the existing PostgreSQL/Drizzle schema. */
export class DatabaseDataProvider {
  readonly kind = 'database' as const

  ensureDemoCases() {
    return ensureDatabaseDemoCases()
  }

  getCasesWithStats() {
    return getDatabaseCasesWithStats()
  }

  getDashboard() {
    return getDatabaseDashboard()
  }

  getCaseBundle(caseId: number) {
    return getDatabaseCaseBundle(caseId)
  }
}

/** Process-local synthetic provider; never claims PostgreSQL or Hindsight persistence. */
export class DemoDataProvider {
  readonly kind = 'local-demo' as const

  ensureDemoCases() {
    return Promise.resolve()
  }

  getCasesWithStats() {
    return Promise.resolve(listDemoCases())
  }

  getDashboard() {
    return Promise.resolve(getDemoDashboard())
  }

  getCaseBundle(caseId: number) {
    return Promise.resolve(getDemoCaseBundle(caseId))
  }
}

const databaseDataProvider = new DatabaseDataProvider()
const demoDataProvider = new DemoDataProvider()
const selectedDataProvider = () => isDatabaseDataMode() ? databaseDataProvider : demoDataProvider

export function ensureDemoCases() {
  return selectedDataProvider().ensureDemoCases()
}

export function getCasesWithStats(): Promise<CaseWithStats[]> {
  return selectedDataProvider().getCasesWithStats()
}

export function getDashboard() {
  return selectedDataProvider().getDashboard()
}

export function getCaseBundle(caseId: number): Promise<CaseBundle | null> {
  return selectedDataProvider().getCaseBundle(caseId)
}

export { inArray }
