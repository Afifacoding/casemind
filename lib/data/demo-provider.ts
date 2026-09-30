import { DEMO_CASES } from '@/lib/demo/cases'
import { SCORE_FACTORS } from '@/lib/agent/scoring'
import type { CaseBundle, CaseWithStats } from '@/lib/data/types'
import type { DemoCase } from '@/lib/demo/cases'
import type { EvidenceType, WhatChanged, MemoryStatus, RecalledMemory, MemoryOperation } from '@/lib/types'
import type {
  Case, CaseEvent, Claim, Contradiction, Evidence, InvestigationUpdate, Person,
  Relationship, ScoreHistoryEntry,
} from '@/lib/db/schema'

const DEMO_MEMORY_STATUS: MemoryStatus = {
  bankId: 'not-configured',
  recall: { status: 'unconfigured', detail: 'Hindsight is not configured. This local demo provider does not simulate remote memory.' },
  retain: { status: 'unconfigured', detail: 'Hindsight is not configured. This local demo provider does not simulate remote memory.' },
}

const EVIDENCE_DETAILS: Record<string, {
  summary: string
  findings: string[]
  locations: string[]
  times: string[]
  people: string[]
  questions?: string[]
}> = {
  'warehouse-theft:1': {
    summary: 'Witness 1 places the delivery at approximately 8:00 PM and says they did not see who was present.',
    findings: ['Witness 1 estimated the delivery at approximately 8:00 PM.', 'The loading bay door was reportedly open around that time.', 'The witness did not see who was present.'],
    locations: ['Northgate Distribution Warehouse', 'loading bay'], times: ['8:00 PM'], people: ['Person A', 'Witness 1'],
  },
  'warehouse-theft:3': {
    summary: 'Delivery system log records completion at 3:42 PM, conflicting with the initial 8:00 PM witness estimate.',
    findings: ['Delivery #DL-4471 was recorded complete at 3:42 PM.', 'The completion was scanned at the loading bay.'],
    locations: ['Northgate Distribution Warehouse', 'loading bay'], times: ['3:42 PM'], people: [],
    questions: ['Why does the delivery system time differ from the initial witness estimate?'],
  },
  'warehouse-theft:5': {
    summary: 'Badge access records Person A entering the warehouse at 3:35 PM and records no exit until 4:20 PM.',
    findings: ['Person A’s assigned badge entered at 3:35 PM.', 'No exit event is recorded until 4:20 PM.'],
    locations: ['warehouse', 'loading-bay side door'], times: ['3:35 PM', '4:20 PM'], people: ['Person A'],
  },
  'warehouse-theft:6': {
    summary: 'CCTV review describes an individual matching Person A near the loading area from 3:35 PM to 3:50 PM; identification is not conclusive.',
    findings: ['An individual matching Person A’s description was observed near the loading area.', 'The face is not clearly visible.', 'A second unidentified individual appears briefly at 3:47 PM.'],
    locations: ['loading area'], times: ['3:35 PM', '3:50 PM', '3:47 PM'], people: ['Person A'],
  },
  'warehouse-theft:7': {
    summary: 'The driver’s assistant places the truck departure around 3:50 PM and says Person A was at the front office at about 3:45 PM.',
    findings: ['The delivery truck reportedly left around 3:50 PM.', 'The witness says Person A was at the front office at about 3:45 PM, not in the loading area.'],
    locations: ['front office', 'loading area'], times: ['3:45 PM', '3:50 PM'], people: ['Person A', 'Witness 2'],
    questions: ['Where was Person A at approximately 3:45 PM?', 'Which source can independently verify the delivery time?'],
  },
  'missing-equipment:1': {
    summary: 'Inventory report last records thermal imaging camera TC-9 in Storage Room A at 9:00 AM.',
    findings: ['TC-9 was last recorded in Storage Room A at 9:00 AM.', 'TC-9 was not found during the Friday inventory check.'],
    locations: ['Storage Room A'], times: ['9:00 AM'], people: [],
  },
  'missing-equipment:2': {
    summary: 'Access register records Person B entering Storage Room A from 10:15 AM to 10:40 AM.',
    findings: ['Person B entered Storage Room A at 10:15 AM.', 'Person B exited at 10:40 AM.'],
    locations: ['Storage Room A'], times: ['10:15 AM', '10:40 AM'], people: ['Person B'],
  },
  'missing-equipment:3': {
    summary: 'Facilities movement report lists a scheduled 11:00 AM transfer of TC-9 from Storage Room A to Room C; the mover is not recorded.',
    findings: ['The report lists TC-9 transferred from Storage Room A to Room C at 11:00 AM.', 'The person who physically moved the equipment is not recorded.'],
    locations: ['Storage Room A', 'Room C'], times: ['11:00 AM'], people: [],
  },
  'missing-equipment:4': {
    summary: 'Room C access log records Person C entering at 11:20 AM and again at 3:10 PM.',
    findings: ['Person C accessed Room C at 11:20 AM.', 'Person C accessed Room C again at 3:10 PM.'],
    locations: ['Room C'], times: ['11:20 AM', '3:10 PM'], people: ['Person C'],
  },
  'missing-equipment:5': {
    summary: 'A technician says TC-9 remained on its Storage Room A shelf at about 2:00 PM, later than the report’s listed 11:00 AM transfer.',
    findings: ['Witness 3 reports seeing TC-9 on its shelf in Storage Room A at around 2:00 PM.', 'The statement conflicts with the movement report’s 11:00 AM time.'],
    locations: ['Storage Room A'], times: ['2:00 PM', '11:00 AM'], people: ['Witness 3'],
    questions: ['Was 11:00 AM the scheduled time or the actual transfer time?'],
  },
  'missing-equipment:6': {
    summary: 'Updated inventory records TC-9 scanned into Room C at 3:05 PM and corrects 11:00 AM as the scheduled—not actual—transfer time.',
    findings: ['TC-9 was scanned into Room C at 3:05 PM.', 'Facilities corrected the transfer to an actual time of 2:45 PM.', 'The earlier 11:00 AM entry was the scheduled time.'],
    locations: ['Storage Room A', 'Room C'], times: ['3:05 PM', '2:45 PM', '11:00 AM'], people: [],
    questions: ['Who physically moved TC-9 from Storage Room A to Room C?'],
  },
}

function utcDay(day: number) {
  return new Date(Date.UTC(2026, 8, day))
}

function makeCase(demo: DemoCase, id: number): Case {
  const date = utcDay(1)
  return {
    id, slug: demo.slug, title: demo.title, description: demo.description,
    summary: demo.slug === 'warehouse-theft'
      ? 'Warehouse evidence places delivery between an initial approximately 8:00 PM witness estimate and later 3:42–3:50 PM records. Person A is linked to access and CCTV records, while a second witness places Person A at the front office at about 3:45 PM. The timeline and location conflict remain under review.'
      : 'Records trace thermal camera TC-9 from Storage Room A to Room C. Person B is linked to Storage Room A access and Person C to Room C access. A witness challenges the scheduled 11:00 AM transfer entry; the updated record identifies 2:45 PM as the actual transfer time.',
    status: 'open', isDemo: true, createdAt: date, updatedAt: utcDay(29),
  }
}

function evidenceRow(demo: DemoCase, caseId: number, id: number, item: DemoCase['evidence'][number]): Evidence {
  const detail = EVIDENCE_DETAILS[`${demo.slug}:${item.day}`]
  return {
    id, caseId, title: item.title, evidenceType: item.type, content: item.content,
    investigationDay: item.day, status: 'analyzed',
    analysis: {
      analysisMode: 'demo', summary: detail.summary, findings: detail.findings,
      locations: detail.locations, times: detail.times, peopleMentioned: detail.people,
      affectedClaimIds: [], unresolvedQuestions: detail.questions ?? [], hypotheses: [],
    },
    error: null, createdAt: utcDay(item.day), processedAt: utcDay(item.day),
  }
}

function makePerson(id: number, caseId: number, name: string, role: string, score: number, previousScore: number): Person {
  const date = utcDay(7)
  return { id, caseId, name, role, score, previousScore, createdAt: utcDay(1), updatedAt: date }
}

function factor(factorKey: keyof typeof SCORE_FACTORS, explanation: string) {
  const item = SCORE_FACTORS[factorKey]
  return { factor: factorKey, label: item.label, weight: item.weight, explanation }
}

function makeHistory(id: number, caseId: number, personId: number, evidenceId: number, day: number, score: number, delta: number, factors: ScoreHistoryEntry['factors']): ScoreHistoryEntry {
  return { id, caseId, personId, evidenceId, investigationDay: day, score, delta, factors, createdAt: utcDay(day) }
}

function makeUpdate(id: number, caseId: number, evidenceItem: Evidence, headline: string, change: Partial<WhatChanged>): InvestigationUpdate {
  const whatChanged: WhatChanged = {
    newEvidence: `Day ${evidenceItem.investigationDay} · ${evidenceItem.evidenceType}: ${evidenceItem.analysis?.summary ?? evidenceItem.title}`,
    previousBelief: 'Investigation state from earlier evidence in this case.',
    change: 'New evidence added to the case-specific investigation state.',
    impact: 'The evidence, timeline, claims, and related entities are retained for investigator review.',
    supportedAssumptions: [], challengedAssumptions: [], newConnections: [], changedConclusions: [], affectedPeople: [], recalledContext: [],
    ...change,
  }
  return {
    id, caseId, evidenceId: evidenceItem.id, investigationDay: evidenceItem.investigationDay,
    headline, whatChanged, recalledMemories: [], memoryStatus: structuredClone(DEMO_MEMORY_STATUS), createdAt: utcDay(evidenceItem.investigationDay),
  }
}

function seedBundle(demo: DemoCase, caseId: number, firstEvidenceId: number, firstPersonId: number): CaseBundle {
  const caseRow = makeCase(demo, caseId)
  const evidenceItems = demo.evidence.map((item, index) => evidenceRow(demo, caseId, firstEvidenceId + index, item))
  const ids = Object.fromEntries(evidenceItems.map((item) => [item.investigationDay, item.id])) as Record<number, number>
  const warehouse = demo.slug === 'warehouse-theft'
  const people: Person[] = warehouse
    ? [makePerson(firstPersonId, caseId, 'Person A', 'Inventory handler on shift', 63, 81)]
    : [
      makePerson(firstPersonId, caseId, 'Person B', 'Lab technician', 43, 0),
      makePerson(firstPersonId + 1, caseId, 'Person C', 'Project engineer', 43, 0),
      ]

  const claims: Claim[] = warehouse ? [
    { id: caseId * 100 + 1, caseId, statement: 'The delivery happened at approximately 8:00 PM.', status: 'challenged', confidence: 5, supportingEvidenceIds: [ids[1]], contradictingEvidenceIds: [ids[3]], relatedPeople: [], relatedEvents: ['Warehouse delivery'], lastUpdatedDay: 3, createdAt: utcDay(1), updatedAt: utcDay(3) },
    { id: caseId * 100 + 2, caseId, statement: 'Person A was present near the loading area during the delivery window.', status: 'challenged', confidence: 5, supportingEvidenceIds: [ids[5], ids[6]], contradictingEvidenceIds: [ids[7]], relatedPeople: ['Person A'], relatedEvents: ['Loading-area activity'], lastUpdatedDay: 7, createdAt: utcDay(5), updatedAt: utcDay(7) },
  ] : [
    { id: caseId * 100 + 1, caseId, statement: 'TC-9 was last recorded in Storage Room A at 9:00 AM.', status: 'supported', confidence: 65, supportingEvidenceIds: [ids[1]], contradictingEvidenceIds: [], relatedPeople: [], relatedEvents: ['TC-9 inventory status'], lastUpdatedDay: 1, createdAt: utcDay(1), updatedAt: utcDay(1) },
    { id: caseId * 100 + 2, caseId, statement: 'TC-9 was transferred from Storage Room A to Room C at 11:00 AM.', status: 'challenged', confidence: 5, supportingEvidenceIds: [ids[3]], contradictingEvidenceIds: [ids[5]], relatedPeople: [], relatedEvents: ['TC-9 equipment movement'], lastUpdatedDay: 6, createdAt: utcDay(3), updatedAt: utcDay(6) },
    { id: caseId * 100 + 3, caseId, statement: 'TC-9 was transferred from Storage Room A to Room C at approximately 2:45 PM.', status: 'supported', confidence: 65, supportingEvidenceIds: [ids[6]], contradictingEvidenceIds: [], relatedPeople: [], relatedEvents: ['TC-9 equipment movement'], lastUpdatedDay: 6, createdAt: utcDay(6), updatedAt: utcDay(6) },
  ]

  const events: CaseEvent[] = evidenceItems.map((item, index) => {
    const day = item.investigationDay
    const key = `${demo.slug}:${day}`
    const detail = EVIDENCE_DETAILS[key]
    const timeLabel = detail.times.join(' – ') || 'Time not stated'
    const time = detail.times[0]?.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i)
    const sortMinutes = time ? ((Number(time[1]) % 12) + (time[3].toUpperCase() === 'PM' ? 12 : 0)) * 60 + Number(time[2] ?? 0) : null
    const title = warehouse
      ? [1, 3, 7].includes(day) ? 'Warehouse delivery' : 'Loading-area activity'
      : [3, 5, 6].includes(day) ? 'TC-9 equipment movement' : [2, 4].includes(day) ? 'Room access' : 'TC-9 inventory status'
    return {
      id: caseId * 100 + index + 1, caseId, evidenceId: item.id, title,
      description: detail.summary, timeLabel, sortMinutes, location: detail.locations[0] ?? '',
      people: detail.people.filter((name) => /^Person /.test(name)), investigationDay: day, createdAt: utcDay(day),
    }
  })

  const relationships: Relationship[] = []
  let relationId = caseId * 100 + 1
  for (const item of evidenceItems) {
    const detail = EVIDENCE_DETAILS[`${demo.slug}:${item.investigationDay}`]
    const linkedPeople = detail.people.filter((name) => /^Person /.test(name))
    for (const person of linkedPeople) {
      for (const location of detail.locations.slice(0, 1)) relationships.push({
        id: relationId++, caseId, evidenceId: item.id, source: person, target: location,
        kind: 'accessed or was reported near', description: `${person} is connected to ${location} in “${item.title}”.`,
        investigationDay: item.investigationDay, createdAt: utcDay(item.investigationDay),
      })
    }
    if (!warehouse && item.investigationDay === 3) {
      relationships.push({ id: relationId++, caseId, evidenceId: item.id, source: 'TC-9', target: 'Storage Room A', kind: 'transferred from', description: 'Movement report records TC-9 leaving Storage Room A.', investigationDay: 3, createdAt: utcDay(3) })
      relationships.push({ id: relationId++, caseId, evidenceId: item.id, source: 'TC-9', target: 'Room C', kind: 'transferred to', description: 'Movement report records TC-9 arriving at Room C.', investigationDay: 3, createdAt: utcDay(3) })
    }
    if (!warehouse && item.investigationDay === 6) {
      relationships.push({ id: relationId++, caseId, evidenceId: item.id, source: 'TC-9', target: 'Room C', kind: 'updated inventory location', description: 'Updated inventory scan at 3:05 PM confirms TC-9 was recorded in Room C.', investigationDay: 6, createdAt: utcDay(6) })
    }
  }

  const contradictions: Contradiction[] = warehouse ? [
    { id: caseId * 100 + 1, caseId, evidenceId: ids[3], conflictingEvidenceId: ids[1], claimId: claims[0].id, kind: 'time', description: 'The initial witness account places the delivery at approximately 8:00 PM, while the delivery system records completion at 3:42 PM. The sources conflict; neither is treated as conclusive.', status: 'unresolved', investigationDay: 3, createdAt: utcDay(3) },
    { id: caseId * 100 + 2, caseId, evidenceId: ids[7], conflictingEvidenceId: ids[6], claimId: claims[1].id, kind: 'person', description: 'CCTV describes an individual matching Person A near the loading area between 3:35 PM and 3:50 PM, while a witness says Person A was at the front office around 3:45 PM. The accounts conflict and remain unresolved.', status: 'unresolved', investigationDay: 7, createdAt: utcDay(7) },
  ] : [
    { id: caseId * 100 + 1, caseId, evidenceId: ids[5], conflictingEvidenceId: ids[3], claimId: claims[1].id, kind: 'time', description: 'A witness places TC-9 in Storage Room A at about 2:00 PM, later than the movement report’s listed 11:00 AM transfer. The updated inventory record explains that 11:00 AM was scheduled time and records the actual transfer at 2:45 PM; this timing discrepancy is marked explained, while the mover remains unknown.', status: 'explained', investigationDay: 6, createdAt: utcDay(5) },
  ]

  const scoreHistory: ScoreHistoryEntry[] = warehouse ? [
    makeHistory(1, caseId, firstPersonId, ids[1], 1, 25, 25, [
      { factor: 'baseline', label: 'First connected to the case', weight: 20, explanation: 'Baseline assigned when Person A first appears in the fictional shift roster.' },
      factor('direct_mention', 'The witness evidence names Person A in the shift roster, but does not say they attended the loading area.'),
    ]),
    makeHistory(2, caseId, firstPersonId, ids[5], 5, 53, 28, [
      factor('location_link', 'The access log records Person A’s assigned badge entering the warehouse at 3:35 PM.'),
      factor('time_window_link', 'The recorded access overlaps the delivery system time of 3:42 PM.'),
    ]),
    makeHistory(3, caseId, firstPersonId, ids[6], 6, 81, 28, [
      factor('location_link', 'CCTV review places an individual matching Person A near the loading area.'),
      factor('time_window_link', 'CCTV observation overlaps 3:35–3:50 PM delivery records.'),
    ]),
    makeHistory(4, caseId, firstPersonId, ids[7], 7, 63, -18, [
      factor('places_elsewhere', 'The second witness says Person A was at the front office around 3:45 PM, challenging the loading-area account.'),
    ]),
  ] : [
    makeHistory(1, caseId, firstPersonId, ids[2], 2, 43, 43, [
      { factor: 'baseline', label: 'First connected to the case', weight: 20, explanation: 'Baseline assigned when Person B first appears in the access register.' },
      factor('location_link', 'The access register records Person B entering Storage Room A.'),
      factor('direct_mention', 'The source identifies Person B as the lab technician using the room.'),
    ]),
    makeHistory(2, caseId, firstPersonId + 1, ids[4], 4, 43, 43, [
      { factor: 'baseline', label: 'First connected to the case', weight: 20, explanation: 'Baseline assigned when Person C first appears in the access log.' },
      factor('location_link', 'The access log records Person C accessing Room C.'),
      factor('direct_mention', 'The source identifies Person C as the project engineer using the room.'),
    ]),
  ]

  const updates: InvestigationUpdate[] = evidenceItems.map((item, index) => {
    const day = item.investigationDay
    const scoreForDay = scoreHistory.filter((entry) => entry.evidenceId === item.id)
    if (warehouse && day === 3) return makeUpdate(caseId * 100 + index + 1, caseId, item, 'Delivery log challenges the initial timeline', {
      previousBelief: 'Witness 1 estimated that the delivery happened at approximately 8:00 PM.',
      change: 'The delivery system records completion at 3:42 PM, creating an unresolved timeline contradiction.',
      impact: 'The delivery time is disputed; neither the witness nor system record is presumed correct.',
      challengedAssumptions: [claims[0].statement], changedConclusions: ['The delivery time remains unresolved.'],
      newConnections: ['3:42 PM delivery record ↔ loading bay'],
    })
    if (warehouse && day === 7) return makeUpdate(caseId * 100 + index + 1, caseId, item, 'Second witness challenges Person A location account', {
      previousBelief: 'Badge and CCTV records connect Person A to the warehouse and loading-area time window.',
      change: 'The second witness places Person A at the front office near the CCTV observation time and reports truck departure around 3:50 PM.',
      impact: 'A second unresolved conflict now concerns Person A’s precise location during the delivery window.',
      challengedAssumptions: ['Person A was near the loading area throughout the full time window.'],
      newConnections: ['Person A ↔ front office ↔ approximately 3:45 PM'],
      changedConclusions: ['Person A location requires further corroboration.'],
      affectedPeople: ['Person A'],
    })
    if (!warehouse && day === 5) return makeUpdate(caseId * 100 + index + 1, caseId, item, 'Witness challenges scheduled transfer time', {
      previousBelief: 'Facilities movement report listed 11:00 AM for TC-9 transfer to Room C.',
      change: 'Witness 3 reports TC-9 remained in Storage Room A at around 2:00 PM, later than the listed time.',
      impact: 'The relationship between the scheduled entry and actual movement time needs reconciliation.',
      challengedAssumptions: [claims[1].statement],
      newConnections: ['TC-9 ↔ Storage Room A ↔ approximately 2:00 PM'],
    })
    if (!warehouse && day === 6) return makeUpdate(caseId * 100 + index + 1, caseId, item, 'Updated inventory reconciles transfer timing', {
      previousBelief: 'The 11:00 AM movement entry appeared to conflict with the witness observation at 2:00 PM.',
      change: 'Facilities clarifies that 11:00 AM was the scheduled time; the actual move was recorded at 2:45 PM and inventory scanned into Room C at 3:05 PM.',
      impact: 'The timing contradiction is explained by the schedule-versus-actual distinction. The person who moved the equipment remains unknown.',
      supportedAssumptions: [claims[2].statement],
      newConnections: ['TC-9 ↔ Room C ↔ updated inventory scan'],
      changedConclusions: ['Actual transfer time is recorded as 2:45 PM; mover is not identified.'],
    })
    return makeUpdate(caseId * 100 + index + 1, caseId, item, `Day ${day}: ${item.title} added`, {
      change: `${item.analysis?.summary ?? item.title}${scoreForDay.length ? ` Evidence Association Score ${scoreForDay.map((entry) => `${people.find((person) => person.id === entry.personId)?.name} ${entry.score - entry.delta} → ${entry.score}/100`).join(', ')}.` : ''}`,
      affectedPeople: item.analysis?.peopleMentioned.filter((name) => /^Person /.test(name)) ?? [],
    })
  })

  return {
    case: caseRow, evidence: evidenceItems, people, claims, events, relationships, contradictions,
    updates: updates.sort((a, b) => b.investigationDay - a.investigationDay || b.id - a.id),
    scoreHistory: scoreHistory.sort((a, b) => a.investigationDay - b.investigationDay || a.id - b.id),
    unresolvedQuestions: warehouse
      ? ['Why does the delivery system time differ from the initial witness estimate?', 'Where was Person A at approximately 3:45 PM?', 'Which source can independently verify the delivery time?']
      : ['Who physically moved TC-9 from Storage Room A to Room C?'],
    hypotheses: [],
    statusLabel: contradictions.some((item) => !['explained', 'resolved'].includes(item.status))
      ? 'Contradictions under review'
      : 'Active investigation',
  } as CaseBundle
}

type DemoState = { bundles: Map<number, CaseBundle>; nextCaseId: number; nextEvidenceId: number; nextPersonId: number }
const stateKey = '__casemindDemoState'
type GlobalWithDemo = typeof globalThis & { [stateKey]?: DemoState }

function getState(): DemoState {
  const global = globalThis as GlobalWithDemo
  if (!global[stateKey]) {
    global[stateKey] = {
      bundles: new Map([
        [1, seedBundle(DEMO_CASES[0], 1, 1, 1)],
        [2, seedBundle(DEMO_CASES[1], 2, 6, 2)],
      ]),
      nextCaseId: 3,
      nextEvidenceId: 12,
      nextPersonId: 4,
    }
  }
  return global[stateKey]!
}

function stats(bundle: CaseBundle): CaseWithStats {
  const analyzed = bundle.evidence.filter((item) => item.status === 'analyzed').length
  const queued = bundle.evidence.filter((item) => item.status === 'queued').length
  const open = bundle.contradictions.filter((item) => !['explained', 'resolved'].includes(item.status)).length
  return {
    ...bundle.case,
    evidenceCount: analyzed, queuedCount: queued, peopleCount: bundle.people.length,
    claimCount: bundle.claims.length, contradictionCount: bundle.contradictions.length,
    unresolvedQuestions: bundle.unresolvedQuestions,
    statusLabel: analyzed === 0 ? 'Awaiting evidence' : open ? 'Contradictions under review' : 'Active investigation',
  }
}

export function listDemoCases(): CaseWithStats[] {
  return [...getState().bundles.values()].map(stats)
}

export function getDemoCaseBundle(caseId: number): CaseBundle | null {
  return getState().bundles.get(caseId) ?? null
}

export function getDemoDashboard() {
  const cases = listDemoCases()
  const bundles = [...getState().bundles.values()]
  const recentUpdates = bundles.flatMap((bundle) => bundle.updates.map((update) => ({
    id: update.id, caseId: update.caseId, headline: update.headline,
    investigationDay: update.investigationDay, whatChanged: update.whatChanged,
    createdAt: update.createdAt, caseTitle: bundle.case.title,
  }))).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 8)
  return {
    cases,
    totals: {
      activeCases: cases.length,
      evidence: cases.reduce((sum, item) => sum + item.evidenceCount, 0),
      people: cases.reduce((sum, item) => sum + item.peopleCount, 0),
      contradictions: cases.reduce((sum, item) => sum + item.contradictionCount, 0),
      unresolved: cases.reduce((sum, item) => sum + item.unresolvedQuestions.length, 0),
    },
    recentUpdates,
  }
}

export function createDemoCase(title: string, description: string) {
  const state = getState()
  const id = state.nextCaseId++
  const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'case'}-${Date.now().toString(36)}`
  const now = new Date()
  const caseRow: Case = { id, slug, title, description, summary: '', status: 'open', isDemo: false, createdAt: now, updatedAt: now }
  state.bundles.set(id, {
    case: caseRow, evidence: [], people: [], claims: [], events: [], relationships: [], contradictions: [],
    updates: [], scoreHistory: [], unresolvedQuestions: [], hypotheses: [], statusLabel: 'Awaiting evidence',
  } as CaseBundle)
  return id
}

function replaceBundle(bundle: CaseBundle) {
  getState().bundles.set(bundle.case.id, bundle)
}

export function addDemoEvidence(
  input: { caseId: number; title: string; evidenceType: EvidenceType; content: string; investigationDay: number },
  memoryContext: { bankId: string; recall: MemoryOperation; memories: RecalledMemory[] } = { bankId: '', recall: DEMO_MEMORY_STATUS.recall, memories: [] },
): { headline: string; evidenceId: number } {
  const state = getState()
  const bundle = state.bundles.get(input.caseId)
  if (!bundle) throw new Error('Case not found')
  const id = state.nextEvidenceId++
  const mentionedPeople = [...input.content.matchAll(/\bPerson [A-Z]\b/g)].map((m) => m[0]).filter((name, index, names) => names.indexOf(name) === index)
  const times = [...input.content.matchAll(/\b\d{1,2}(?::\d{2})?\s?(?:AM|PM)\b/gi)].map((m) => m[0].toUpperCase())
  const locations = [...input.content.matchAll(/\b(?:Storage Room [A-Z]|Room [A-Z]|loading area|loading bay|front office|warehouse)\b/gi)].map((m) => m[0]).filter((name, index, names) => names.indexOf(name) === index)
  const findings = input.content.split(/(?<=[.!?])\s+/).filter(Boolean).slice(0, 4)
  const evidenceItem: Evidence = {
    id, caseId: input.caseId, title: input.title, evidenceType: input.evidenceType, content: input.content,
    investigationDay: input.investigationDay, status: 'analyzed',
    analysis: { analysisMode: 'demo', summary: findings[0] ?? input.content, findings, locations, times, peopleMentioned: mentionedPeople, affectedClaimIds: [], unresolvedQuestions: [], hypotheses: [] },
    error: null, createdAt: new Date(), processedAt: new Date(),
  }
  const newEvents: CaseEvent[] = [{
    id: id + 10_000, caseId: input.caseId, evidenceId: id,
    title: bundle.case.slug === 'warehouse-theft' ? 'Warehouse investigation event' : bundle.case.slug === 'missing-equipment' ? 'Equipment investigation event' : 'Evidence event',
    description: evidenceItem.analysis!.summary, timeLabel: times.join(' – ') || 'Time not stated', sortMinutes: null,
    location: locations[0] ?? '', people: mentionedPeople, investigationDay: input.investigationDay, createdAt: new Date(),
  }]
  const newRelationships: Relationship[] = [
    ...mentionedPeople.map((person, index) => ({ id: id * 100 + index, caseId: input.caseId, evidenceId: id, source: person, target: locations[0] ?? newEvents[0].title, kind: 'mentioned in evidence', description: `${person} is mentioned in ${input.title}.`, investigationDay: input.investigationDay, createdAt: new Date() })),
    ...(!bundle.case.slug.includes('warehouse') && /TC-9|equipment/i.test(input.content) ? locations.map((location, index) => ({ id: id * 100 + 50 + index, caseId: input.caseId, evidenceId: id, source: 'TC-9', target: location, kind: 'mentioned at', description: `${input.title} links equipment to ${location}.`, investigationDay: input.investigationDay, createdAt: new Date() })) : []),
  ]
  const analysisSummary = evidenceItem.analysis?.summary ?? input.content
  const change = `New evidence added: ${analysisSummary}`
  const update = makeUpdate(id + 20_000, input.caseId, evidenceItem, `${input.title} added to investigation`, {
    newEvidence: `Day ${input.investigationDay} · ${input.evidenceType}: ${analysisSummary}`,
    previousBelief: memoryContext.memories.length
      ? `Relevant Hindsight case memories recalled: ${memoryContext.memories.slice(0, 3).map((memory) => memory.text).join(' | ').slice(0, 700)}`
      : 'No relevant Hindsight memory was recalled; the local structured case state remains the analysis context.',
    change: memoryContext.memories.length ? `${change} Prior case memories were recalled before processing this new evidence.` : change,
    affectedPeople: mentionedPeople,
    newConnections: newRelationships.map((item) => `${item.source} ↔ ${item.target}`),
    recalledContext: memoryContext.memories.slice(0, 8).map((memory) => memory.text),
  })
  update.memoryStatus = {
    bankId: memoryContext.bankId,
    recall: memoryContext.recall,
    retain: DEMO_MEMORY_STATUS.retain,
  }
  replaceBundle({
    ...bundle,
    case: { ...bundle.case, summary: [bundle.case.summary, change].filter(Boolean).join(' '), updatedAt: new Date() },
    evidence: [...bundle.evidence, evidenceItem].sort((a, b) => a.investigationDay - b.investigationDay || a.id - b.id),
    events: [...bundle.events, ...newEvents], relationships: [...bundle.relationships, ...newRelationships],
    updates: [update, ...bundle.updates].sort((a, b) => b.investigationDay - a.investigationDay || b.id - a.id),
  })
  return { headline: update.headline, evidenceId: id }
}

export function peekNextDemoEvidence(caseId: number) {
  const bundle = getDemoCaseBundle(caseId)
  return bundle?.evidence
    .filter((item) => item.status === 'queued')
    .sort((a, b) => a.investigationDay - b.investigationDay || a.id - b.id)[0] ?? null
}

export function processNextDemoEvidence(
  caseId: number,
  memoryContext?: { bankId: string; recall: MemoryOperation; memories: RecalledMemory[] },
): { headline: string; remaining: number; evidenceId: number } | null {
  const bundle = getDemoCaseBundle(caseId)
  if (!bundle) return null
  const queued = bundle.evidence.filter((item) => item.status === 'queued').sort((a, b) => a.investigationDay - b.investigationDay || a.id - b.id)
  const item = queued[0]
  if (!item) return null
  const generatedResult = addDemoEvidence({ caseId, title: item.title, evidenceType: item.evidenceType as EvidenceType, content: item.content, investigationDay: item.investigationDay }, memoryContext)
  const updatedBundle = getDemoCaseBundle(caseId)!
  const generatedEvidenceId = generatedResult.evidenceId
  const generatedRecord = updatedBundle.evidence.find((evidence) => evidence.id === generatedEvidenceId)
  const generatedUpdate = updatedBundle.updates.find((update) => update.evidenceId === generatedEvidenceId)
  updatedBundle.evidence = updatedBundle.evidence.filter((evidence) => evidence.id !== generatedEvidenceId)
  updatedBundle.events = updatedBundle.events.map((event) => event.evidenceId === generatedEvidenceId ? { ...event, evidenceId: item.id } : event)
  updatedBundle.relationships = updatedBundle.relationships.map((relationship) => relationship.evidenceId === generatedEvidenceId ? { ...relationship, evidenceId: item.id } : relationship)
  item.status = 'analyzed'
  item.processedAt = new Date()
  if (generatedRecord) item.analysis = generatedRecord.analysis
  if (generatedUpdate) generatedUpdate.evidenceId = item.id
  updatedBundle.evidence.sort((a, b) => a.investigationDay - b.investigationDay || a.id - b.id)
  replaceBundle(updatedBundle)
  return { headline: generatedResult.headline, remaining: queued.length - 1, evidenceId: item.id }
}

export function attachDemoMemoryOperations(
  caseId: number,
  evidenceId: number,
  bankId: string,
  recall: MemoryOperation,
  retain: MemoryOperation,
) {
  const bundle = getDemoCaseBundle(caseId)
  const update = bundle?.updates.find((item) => item.evidenceId === evidenceId)
  if (!bundle || !update) return false
  update.memoryStatus = { bankId, recall, retain }
  replaceBundle(bundle)
  return true
}

export function retryDemoEvidenceLocal(evidenceId: number): { caseId: number; message: string } | null {
  for (const bundle of getState().bundles.values()) {
    const item = bundle.evidence.find((entry) => entry.id === evidenceId)
    if (!item) continue
    if (item.status !== 'failed') return { caseId: bundle.case.id, message: 'Evidence is already available in the local demo case.' }
    item.status = 'analyzed'
    item.error = null
    item.processedAt = new Date()
    item.analysis ??= {
      analysisMode: 'demo', summary: item.content.slice(0, 240), findings: [item.content],
      locations: [], times: [], peopleMentioned: [], affectedClaimIds: [], unresolvedQuestions: [], hypotheses: [],
    }
    bundle.case.updatedAt = new Date()
    return { caseId: bundle.case.id, message: 'Evidence restored using local demo analysis.' }
  }
  return null
}

export function resetDemoCaseLocal(caseId: number): boolean {
  const old = getState().bundles.get(caseId)
  const definition = old && DEMO_CASES.find((item) => item.slug === old.case.slug)
  if (!old || !definition) return false
  const refreshed = seedBundle(definition, caseId, getState().nextEvidenceId, getState().nextPersonId)
  getState().nextEvidenceId += definition.evidence.length
  replaceBundle(refreshed)
  return true
}

export function setDemoContradictionStatus(caseId: number, contradictionId: number, status: Contradiction['status']): boolean {
  const bundle = getDemoCaseBundle(caseId)
  const contradiction = bundle?.contradictions.find((item) => item.id === contradictionId)
  if (!bundle || !contradiction) return false
  if (contradiction.status === status) return true
  const before = contradiction.status
  contradiction.status = status
  const evidenceItem = bundle.evidence.find((item) => item.id === contradiction.evidenceId)
  if (!evidenceItem) return false
  const update = makeUpdate(getState().nextEvidenceId++ + 30_000, caseId, evidenceItem, `Contradiction marked ${status}`, {
    newEvidence: 'Investigator updated a contradiction status.', previousBelief: `Contradiction status was ${before}.`,
    change: `Status changed from ${before} to ${status}.`, impact: 'Investigator review status changed; no source was determined to be truthful.',
    challengedAssumptions: [contradiction.description],
  })
  replaceBundle({ ...bundle, case: { ...bundle.case, updatedAt: new Date() }, updates: [update, ...bundle.updates] })
  return true
}
