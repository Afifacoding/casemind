import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import type { EvidenceAnalysis, MemoryStatus, RecalledMemory, WhatChanged } from '@/lib/types'

export const cases = pgTable('cases', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  summary: text('summary').notNull().default(''),
  status: text('status').notNull().default('unresolved'),
  isDemo: boolean('is_demo').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex('cases_slug_unique').on(table.slug)])

export const evidence = pgTable('evidence', {
  id: serial('id').primaryKey(),
  caseId: integer('case_id').notNull(),
  title: text('title').notNull(),
  evidenceType: text('evidence_type').notNull(),
  content: text('content').notNull(),
  investigationDay: integer('investigation_day').notNull(),
  status: text('status').notNull().default('pending'),
  analysis: jsonb('analysis').$type<EvidenceAnalysis | null>(),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
})

export const people = pgTable('people', {
  id: serial('id').primaryKey(),
  caseId: integer('case_id').notNull(),
  name: text('name').notNull(),
  role: text('role').notNull().default(''),
  score: integer('score').notNull().default(0),
  previousScore: integer('previous_score').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const claims = pgTable('claims', {
  id: serial('id').primaryKey(),
  caseId: integer('case_id').notNull(),
  statement: text('statement').notNull(),
  status: text('status').notNull().default('unresolved'),
  confidence: integer('confidence').notNull().default(50),
  supportingEvidenceIds: integer('supporting_evidence_ids').array().notNull().default([]),
  contradictingEvidenceIds: integer('contradicting_evidence_ids').array().notNull().default([]),
  relatedPeople: text('related_people').array().notNull().default([]),
  relatedEvents: text('related_events').array().notNull().default([]),
  lastUpdatedDay: integer('last_updated_day').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const events = pgTable('events', {
  id: serial('id').primaryKey(),
  caseId: integer('case_id').notNull(),
  evidenceId: integer('evidence_id').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  timeLabel: text('time_label').notNull().default(''),
  sortMinutes: integer('sort_minutes'),
  location: text('location').notNull().default(''),
  people: text('people').array().notNull().default([]),
  investigationDay: integer('investigation_day').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const relationships = pgTable('relationships', {
  id: serial('id').primaryKey(),
  caseId: integer('case_id').notNull(),
  evidenceId: integer('evidence_id').notNull(),
  source: text('source').notNull(),
  target: text('target').notNull(),
  kind: text('kind').notNull(),
  description: text('description').notNull().default(''),
  investigationDay: integer('investigation_day').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const contradictions = pgTable('contradictions', {
  id: serial('id').primaryKey(),
  caseId: integer('case_id').notNull(),
  evidenceId: integer('evidence_id').notNull(),
  conflictingEvidenceId: integer('conflicting_evidence_id').notNull(),
  claimId: integer('claim_id'),
  kind: text('kind').notNull(),
  description: text('description').notNull(),
  status: text('status').notNull().default('open'),
  investigationDay: integer('investigation_day').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const investigationUpdates = pgTable('investigation_updates', {
  id: serial('id').primaryKey(),
  caseId: integer('case_id').notNull(),
  evidenceId: integer('evidence_id').notNull(),
  investigationDay: integer('investigation_day').notNull(),
  headline: text('headline').notNull(),
  whatChanged: jsonb('what_changed').$type<WhatChanged>().notNull(),
  recalledMemories: jsonb('recalled_memories').$type<RecalledMemory[]>().notNull(),
  memoryStatus: jsonb('memory_status').$type<MemoryStatus>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const scoreHistory = pgTable('score_history', {
  id: serial('id').primaryKey(),
  caseId: integer('case_id').notNull(),
  personId: integer('person_id').notNull(),
  evidenceId: integer('evidence_id').notNull(),
  investigationDay: integer('investigation_day').notNull(),
  score: integer('score').notNull(),
  delta: integer('delta').notNull(),
  factors: jsonb('factors').$type<AppliedFactor[]>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type AppliedFactor = {
  factor: string
  label: string
  weight: number
  explanation: string
}

export type Case = typeof cases.$inferSelect
export type Evidence = typeof evidence.$inferSelect
export type Person = typeof people.$inferSelect
export type Claim = typeof claims.$inferSelect
export type CaseEvent = typeof events.$inferSelect
export type Relationship = typeof relationships.$inferSelect
export type Contradiction = typeof contradictions.$inferSelect
export type InvestigationUpdate = typeof investigationUpdates.$inferSelect
export type ScoreHistoryEntry = typeof scoreHistory.$inferSelect
