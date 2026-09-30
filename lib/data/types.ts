import type {
  Case, CaseEvent, Claim, Contradiction, Evidence, InvestigationUpdate, Person,
  Relationship, ScoreHistoryEntry,
} from '@/lib/db/schema'

export type CaseWithStats = Case & {
  evidenceCount: number
  queuedCount: number
  peopleCount: number
  claimCount: number
  contradictionCount: number
  unresolvedQuestions: string[]
  statusLabel: string
}

export type CaseBundle = {
  case: Case
  evidence: Evidence[]
  people: Person[]
  claims: Claim[]
  events: CaseEvent[]
  relationships: Relationship[]
  contradictions: Contradiction[]
  updates: InvestigationUpdate[]
  scoreHistory: ScoreHistoryEntry[]
  unresolvedQuestions: string[]
  hypotheses: string[]
  statusLabel: string
}