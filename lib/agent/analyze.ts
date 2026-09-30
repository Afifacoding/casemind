import { generateText, Output } from 'ai'
import { z } from 'zod'
import { SCORE_FACTORS, SCORE_FACTOR_KEYS } from './scoring'
import { analyzeDemoEvidence } from './demo-analysis'
import type { RecalledMemory } from '@/lib/types'

export const DEFAULT_MODEL = 'openai/gpt-5-mini'

export function getModelId() {
  return process.env.CASEMIND_MODEL || DEFAULT_MODEL
}

export function isModelConfigured() {
  return Boolean(process.env.AI_GATEWAY_API_KEY)
}

const analysisSchema = z.object({
  summary: z.string().describe('One or two sentence neutral summary of the new evidence.'),
  findings: z.array(z.string()).describe('Important factual findings in the new evidence.'),
  locations: z.array(z.string()),
  times: z.array(z.string()).describe('Times or dates stated in the evidence, e.g. "3:42 PM".'),
  people: z
    .array(
      z.object({
        name: z.string().describe('Exact existing name if the person is already known, e.g. "Person A".'),
        role: z.string().describe('Neutral role/context, e.g. "Inventory handler on shift".'),
      }),
    )
    .describe('Specific individuals referenced. Exclude unnamed/unidentified people.'),
  events: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      timeLabel: z.string().describe('Stated time, e.g. "3:42 PM" or "Unknown".'),
      sortMinutes: z.number().int().nullable().describe('Minutes since midnight for the stated time, or null.'),
      location: z.string(),
      people: z.array(z.string()),
    }),
  ),
  claimUpdates: z
    .array(
      z.object({
        existingClaimId: z
          .number()
          .int()
          .nullable()
          .describe('ID of an existing claim this evidence supports or contradicts, or null to create a new claim.'),
        relation: z.enum(['supports', 'contradicts']),
        statement: z.string().describe('For new claims: a neutral, testable claim statement. For existing claims repeat the statement.'),
        relatedPeople: z.array(z.string()),
        relatedEvents: z.array(z.string()),
      }),
    )
    .describe('How this evidence affects claims. Always contradict an existing claim when the evidence conflicts with it.'),
  contradictions: z
    .array(
      z.object({
        conflictingEvidenceId: z.number().int().describe('ID of the EARLIER evidence item that conflicts.'),
        claimId: z.number().int().nullable(),
        kind: z.enum(['time', 'location', 'person', 'statement', 'timeline']),
        description: z.string().describe('Neutral explanation of the conflict. Do not decide which source is truthful.'),
      }),
    )
    .describe('Conflicts between THIS evidence and specific earlier evidence items only.'),
  relationships: z.array(
    z.object({
      source: z.string(),
      target: z.string(),
      kind: z.string().describe('e.g. "present at", "accessed", "moved to", "recorded at", "corroborates".'),
      description: z.string(),
    }),
  ),
  scoreFactors: z
    .array(
      z.object({
        person: z.string(),
        factor: z.enum(SCORE_FACTOR_KEYS),
        explanation: z.string().describe('Cite the specific evidence detail that justifies this factor.'),
      }),
    )
    .describe('Defined factors that THIS evidence applies to specific people. Use only when clearly justified.'),
  whatChanged: z.object({
    previousBelief: z.string().describe('What the investigation previously believed that this evidence touches. "No prior belief" if none.'),
    change: z.string().describe('How the understanding changes.'),
    impact: z.string().describe('Impact on the investigation state (timeline, claims, connections).'),
    supportedAssumptions: z.array(z.string()),
    challengedAssumptions: z.array(z.string()),
    newConnections: z.array(z.string()),
    changedConclusions: z.array(z.string()),
    affectedPeople: z.array(z.string()),
    recalledContext: z
      .array(z.string())
      .describe('Which previously remembered facts were relevant to interpreting this evidence, paraphrased.'),
  }),
  headline: z.string().describe('Short headline of the investigation update (max 12 words).'),
  hypotheses: z.array(z.string()).describe('Current working hypotheses about the events (neutral, testable).'),
  unresolvedQuestions: z.array(z.string()).describe('Open questions an investigator should resolve next.'),
  caseSummary: z.string().describe('Updated overall investigation summary after this evidence (3-4 sentences, neutral).'),
})

export type AgentAnalysis = z.infer<typeof analysisSchema>

export type AnalysisContext = {
  caseTitle: string
  caseDescription: string
  currentSummary: string
  newEvidence: { id: number; title: string; type: string; day: number; content: string }
  priorEvidence: { id: number; title: string; type: string; day: number; summary: string }[]
  claims: { id: number; statement: string; status: string; supporting: number[]; contradicting: number[] }[]
  people: { name: string; role: string; score: number }[]
  events: { title: string; timeLabel: string; location: string; day: number }[]
  recalledMemories: RecalledMemory[]
  memoryAvailable: boolean
}

const SYSTEM = `You are CASEMIND, an evidence continuity agent supporting human investigators.
You analyse ONE new evidence item against the remembered state of an investigation.

Rules:
- Never state or imply guilt, innocence, criminal responsibility or likelihood of guilt.
- Use neutral language: "evidence associates", "supported claim", "challenged claim", "unresolved", "contradictory evidence".
- When sources conflict, do not decide which is truthful. Say they conflict and require investigation.
- Only reference prior evidence IDs and claim IDs that are provided.
- Reuse exact existing names for people who are already known.
- A contradiction must be between the new evidence and a specific earlier evidence item.
- Score factors must be one of the defined factors and be clearly justified by the new evidence.

Defined Evidence Association factors (weights applied by the system, not by you):
${Object.entries(SCORE_FACTORS)
  .map(([key, f]) => `- ${key} (${f.weight > 0 ? '+' : ''}${f.weight}): ${f.label}`)
  .join('\n')}`

function formatContext(ctx: AnalysisContext) {
  const memorySection = ctx.memoryAvailable
    ? ctx.recalledMemories.length
      ? ctx.recalledMemories.map((m) => `- ${m.text}`).join('\n')
      : '- (Hindsight returned no relevant memories)'
    : '- (Hindsight memory is not configured; rely on the structured case state below)'

  return `CASE: ${ctx.caseTitle}
${ctx.caseDescription}

CURRENT INVESTIGATION SUMMARY:
${ctx.currentSummary || '(no summary yet — this is the first evidence)'}

RECALLED INVESTIGATION MEMORIES (Hindsight):
${memorySection}

STRUCTURED CASE STATE
Prior evidence:
${ctx.priorEvidence.map((e) => `- [E${e.id}] Day ${e.day} · ${e.type} · ${e.title}: ${e.summary}`).join('\n') || '- none'}

Claims:
${ctx.claims.map((c) => `- [C${c.id}] (${c.status}) ${c.statement} | supporting: ${c.supporting.map((i) => `E${i}`).join(', ') || 'none'} | contradicting: ${c.contradicting.map((i) => `E${i}`).join(', ') || 'none'}`).join('\n') || '- none'}

People:
${ctx.people.map((p) => `- ${p.name} (${p.role}) — association ${p.score}%`).join('\n') || '- none'}

Events:
${ctx.events.map((e) => `- Day ${e.day}: ${e.title} at ${e.timeLabel} · ${e.location}`).join('\n') || '- none'}

NEW EVIDENCE [E${ctx.newEvidence.id}] — Day ${ctx.newEvidence.day} · ${ctx.newEvidence.type} · ${ctx.newEvidence.title}
"""
${ctx.newEvidence.content}
"""`
}

export async function analyzeEvidence(ctx: AnalysisContext): Promise<AgentAnalysis & { analysisMode: 'llm' | 'demo' }> {
  if (!isModelConfigured()) return { ...analyzeDemoEvidence(ctx), analysisMode: 'demo' }
  try {
    const { output } = await generateText({
      model: getModelId(),
      system: SYSTEM,
      prompt: formatContext(ctx),
      output: Output.object({ schema: analysisSchema }),
    })
    return { ...output, analysisMode: 'llm' }
  } catch (error) {
    console.warn('[casemind] model unavailable; using deterministic demo analysis', error)
    return { ...analyzeDemoEvidence(ctx), analysisMode: 'demo' }
  }
}
