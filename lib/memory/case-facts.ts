import type { CaseBundle } from '@/lib/data/types'
import type { RetainItem } from './hindsight'

/** Build discrete, human-readable source memories—never a serialized case blob. */
export function buildCaseMemoryItems(bundle: CaseBundle, onlyEvidenceId?: number): RetainItem[] {
  const caseId = bundle.case.id
  const items: RetainItem[] = []
  const evidenceRows = bundle.evidence.filter((item) => onlyEvidenceId === undefined || item.id === onlyEvidenceId)
  const ids = new Set(evidenceRows.map((item) => item.id))

  function add(evidenceId: number, kind: string, index: number, content: string, day: number, title: string) {
    const evidenceItem = bundle.evidence.find((item) => item.id === evidenceId)
    items.push({
      content,
      context: `CASEMIND investigation case ${caseId}, Day ${day}, ${title}`,
      documentId: `casemind-case-${caseId}-evidence-${evidenceId}-${kind}-${index}`,
      tags: [`case:${caseId}`, `day:${day}`, `evidence:${evidenceId}`],
      timestamp: evidenceItem?.processedAt ?? evidenceItem?.createdAt,
    })
  }

  for (const item of evidenceRows) {
    const analysis = item.analysis
    add(item.id, 'source', 0,
      `Day ${item.investigationDay}, evidence E${item.id} (${item.evidenceType}), source “${item.title}”: ${item.content}`,
      item.investigationDay, item.title)

    analysis?.findings.forEach((finding, index) => add(item.id, 'fact', index,
      `Day ${item.investigationDay}, E${item.id} finding from ${item.title}: ${finding}`,
      item.investigationDay, item.title))
    analysis?.peopleMentioned.forEach((person, index) => add(item.id, 'person', index,
      `Day ${item.investigationDay}, E${item.id} (${item.title}) mentions ${person}. This records a source association only and is not a conclusion about responsibility.`,
      item.investigationDay, item.title))
    analysis?.times.forEach((time, index) => add(item.id, 'time', index,
      `Day ${item.investigationDay}, E${item.id} (${item.title}) states or records time ${time}.`,
      item.investigationDay, item.title))
    analysis?.locations.forEach((location, index) => add(item.id, 'location', index,
      `Day ${item.investigationDay}, E${item.id} (${item.title}) refers to location ${location}.`,
      item.investigationDay, item.title))
    bundle.events.filter((event) => event.evidenceId === item.id).forEach((event, index) => add(item.id, 'event', index,
      `Day ${event.investigationDay} event “${event.title}”: ${event.description} Time: ${event.timeLabel}. Location: ${event.location || 'not stated'}. People mentioned: ${event.people.join(', ') || 'none identified'}.`,
      event.investigationDay, item.title))
    bundle.relationships.filter((relationship) => relationship.evidenceId === item.id).forEach((relationship, index) => add(item.id, 'relationship', index,
      `Day ${relationship.investigationDay}, E${item.id} relationship: ${relationship.source} ${relationship.kind} ${relationship.target}. ${relationship.description}`,
      relationship.investigationDay, item.title))
    bundle.contradictions.filter((conflict) => conflict.evidenceId === item.id).forEach((conflict, index) => {
      const earlier = bundle.evidence.find((entry) => entry.id === conflict.conflictingEvidenceId)
      add(item.id, 'contradiction', index,
        `Day ${conflict.investigationDay}, unresolved-source comparison E${conflict.conflictingEvidenceId} “${earlier?.title ?? 'earlier evidence'}” versus E${item.id} “${item.title}”: ${conflict.description} Review status: ${conflict.status}. Neither source is presumed truthful.`,
        conflict.investigationDay, item.title)
    })
    bundle.scoreHistory.filter((score) => score.evidenceId === item.id).forEach((score, index) => {
      const person = bundle.people.find((entry) => entry.id === score.personId)
      add(item.id, 'score', index,
        `Day ${score.investigationDay}, E${item.id} changed ${person?.name ?? 'a person'} Evidence Association Score to ${score.score}/100 (${score.delta >= 0 ? '+' : ''}${score.delta}). Factors: ${score.factors.map((factor) => `${factor.weight > 0 ? '+' : ''}${factor.weight} ${factor.label} — ${factor.explanation}`).join('; ')}. This is evidence connection strength, not a determination of guilt.`,
        score.investigationDay, item.title)
    })
    bundle.updates.filter((update) => update.evidenceId === item.id).forEach((update, index) => {
      add(item.id, 'state-change', index,
        `Day ${update.investigationDay} investigation update: ${update.headline}. Previous understanding: ${update.whatChanged.previousBelief}. New evidence: ${update.whatChanged.newEvidence}. Change: ${update.whatChanged.change}. Impact: ${update.whatChanged.impact}`,
        update.investigationDay, item.title)
      update.whatChanged.supportedAssumptions.forEach((claim, factIndex) => add(item.id, `supported-${index}`, factIndex,
        `Day ${update.investigationDay}, prior assumption supported by new case evidence: ${claim}`,
        update.investigationDay, item.title))
      update.whatChanged.challengedAssumptions.forEach((claim, factIndex) => add(item.id, `challenged-${index}`, factIndex,
        `Day ${update.investigationDay}, prior assumption challenged by new case evidence and still requires investigator review: ${claim}`,
        update.investigationDay, item.title))
      update.whatChanged.changedConclusions.forEach((conclusion, factIndex) => add(item.id, `conclusion-${index}`, factIndex,
        `Day ${update.investigationDay} investigation conclusion/state update: ${conclusion}`,
        update.investigationDay, item.title))
    })
  }

  for (const claim of bundle.claims) {
    const linkedIds = [...new Set([...claim.supportingEvidenceIds, ...claim.contradictingEvidenceIds])]
    for (const evidenceId of linkedIds.filter((id) => ids.has(id))) {
      const relation = claim.supportingEvidenceIds.includes(evidenceId) ? 'supports' : 'challenges'
      const evidenceItem = bundle.evidence.find((entry) => entry.id === evidenceId)
      add(evidenceId, `claim-${claim.id}`, relation === 'supports' ? 0 : 1,
        `Day ${evidenceItem?.investigationDay ?? claim.lastUpdatedDay}, claim “${claim.statement}” is currently ${relation}d by E${evidenceId} “${evidenceItem?.title ?? 'evidence'}”. Current claim status: ${claim.status}.`,
        evidenceItem?.investigationDay ?? claim.lastUpdatedDay, evidenceItem?.title ?? 'investigation state')
    }
  }

  return items
}
