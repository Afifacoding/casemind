export const EVIDENCE_TYPES = [
  'Witness Statement',
  'System Log',
  'Report',
  'Email',
  'CCTV Report',
  'Other',
] as const

export type EvidenceType = (typeof EVIDENCE_TYPES)[number]

export type RecalledMemory = {
  id: string
  text: string
  type: string | null
  occurredAt: string | null
}

export type MemoryOperation = {
  status: 'ok' | 'unconfigured' | 'error' | 'skipped'
  detail: string
  count?: number
}

export type MemoryStatus = {
  bankId: string
  recall: MemoryOperation
  retain: MemoryOperation
}

export type WhatChanged = {
  newEvidence: string
  previousBelief: string
  change: string
  impact: string
  supportedAssumptions: string[]
  challengedAssumptions: string[]
  newConnections: string[]
  changedConclusions: string[]
  affectedPeople: string[]
  recalledContext: string[]
}

export type EvidenceAnalysis = {
  analysisMode?: 'llm' | 'demo'
  summary: string
  findings: string[]
  locations: string[]
  times: string[]
  peopleMentioned: string[]
  affectedClaimIds: number[]
  unresolvedQuestions: string[]
  hypotheses: string[]
}
