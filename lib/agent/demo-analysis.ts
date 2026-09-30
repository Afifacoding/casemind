import type { AgentAnalysis, AnalysisContext } from './analyze'
import { SCORE_FACTORS, type ScoreFactorKey } from './scoring'

/** Deterministic offline analysis for fictional demo evidence; not an LLM. */
export function analyzeDemoEvidence(ctx: AnalysisContext): AgentAnalysis {
  const { newEvidence: item } = ctx
  const content = item.content
  const warehouse = ctx.caseTitle.toLowerCase().includes('warehouse')
  const equipment = ctx.caseTitle.toLowerCase().includes('equipment')
  const day = item.day
  const times = [...content.matchAll(/\b\d{1,2}(?::\d{2})?\s?(?:AM|PM)\b/gi)].map((m) => m[0].replace(/\s+/g, ' ').toUpperCase())
  const locations = [...content.matchAll(/\b(?:Storage Room [A-Z]|Room [A-Z]|loading area|loading bay|front office|warehouse|Harbor Research Lab|Northgate Distribution Warehouse)\b/gi)]
    .map((m) => m[0])
    .filter((value, index, all) => all.findIndex((other) => other.toLowerCase() === value.toLowerCase()) === index)
  const people = [...content.matchAll(/\bPerson [A-Z]\b/g)]
    .map((m) => m[0])
    .filter((value, index, all) => all.indexOf(value) === index)
    .map((name) => ({
      name,
      role: name === 'Person A' ? 'Inventory handler on shift' : name === 'Person B' ? 'Lab technician' : 'Project engineer',
    }))
  const findings = content
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim().replace(/^"|"$/g, ''))
    .filter(Boolean)
    .slice(0, 3)

  const eventTitle = warehouse
    ? day === 1 || day === 3 || day === 7 ? 'Warehouse delivery' : 'Loading-area activity'
    : /transfer|moved|movement/i.test(content) ? 'TC-9 equipment movement' : /accessed|entered/i.test(content) ? 'Room access' : 'TC-9 inventory status'
  const event = {
    title: eventTitle,
    description: findings[0] ?? item.title,
    timeLabel: times.join(' – ') || 'Time not stated',
    sortMinutes: times.length ? minutesSinceMidnight(times[0]) : null,
    location: locations[0] ?? '',
    people: people.map((person) => person.name),
  }

  const contradictions: AgentAnalysis['contradictions'] = []
  const claimUpdates: AgentAnalysis['claimUpdates'] = []
  const supportedAssumptions: string[] = []
  const challengedAssumptions: string[] = []
  const changedConclusions: string[] = []
  const newConnections: string[] = []

  if (warehouse && /delivery/i.test(content)) {
    const timeClaim = ctx.claims.find((claim) => /delivery.*(?:8:00|approximately|around)/i.test(claim.statement))
    if (day === 1 || !timeClaim) {
      const statement = `The delivery happened at approximately ${times[0] ?? 'the time stated by the witness'}.`
      claimUpdates.push({ existingClaimId: null, relation: 'supports', statement, relatedPeople: [], relatedEvents: [eventTitle] })
      supportedAssumptions.push(statement)
    } else if (timeClaim) {
      const priorDeliveryEvidence = ctx.priorEvidence.filter((e) => /delivery/i.test(`${e.title} ${e.summary}`))
      const incompatible = priorDeliveryEvidence.find((e) => {
        const earlierTimes = [...e.summary.matchAll(/\b\d{1,2}(?::\d{2})?\s?(?:AM|PM)\b/gi)].map((m) => m[0])
        return times.some((time) => earlierTimes.some((earlier) => Math.abs(minutesSinceMidnight(time) - minutesSinceMidnight(earlier)) > 90))
      })
      claimUpdates.push({ existingClaimId: timeClaim.id, relation: incompatible ? 'contradicts' : 'supports', statement: timeClaim.statement, relatedPeople: [], relatedEvents: [eventTitle] })
      if (incompatible) {
        contradictions.push({
          conflictingEvidenceId: incompatible.id,
          claimId: timeClaim.id,
          kind: 'time',
          description: `The initial witness account places the delivery at approximately 8:00 PM, while this ${item.type.toLowerCase()} records it at ${times.join('–') || 'an earlier afternoon time'}. The sources conflict; neither is treated as conclusive.`,
        })
        challengedAssumptions.push(timeClaim.statement)
        changedConclusions.push('Delivery time remains disputed between the initial account and later records.')
      } else {
        supportedAssumptions.push(timeClaim.statement)
      }
    }
  } else if (equipment && /TC-9|thermal camera/i.test(content)) {
    const movementClaim = ctx.claims.find((claim) => /TC-9.*(?:transferred|moved)|(?:transferred|moved).*TC-9/i.test(claim.statement))
    if (day === 1 || /last recorded in Storage Room A/i.test(content)) {
      const statement = 'TC-9 was last recorded in Storage Room A at 9:00 AM.'
      claimUpdates.push({ existingClaimId: null, relation: 'supports', statement, relatedPeople: [], relatedEvents: [eventTitle] })
      supportedAssumptions.push(statement)
    } else if (/later than the time recorded|still on its shelf|2:00 PM/i.test(content) && movementClaim) {
      const priorMovement = ctx.priorEvidence.find((e) => /movement report/i.test(e.title))
      claimUpdates.push({ existingClaimId: movementClaim.id, relation: 'contradicts', statement: movementClaim.statement, relatedPeople: [], relatedEvents: [eventTitle] })
      if (priorMovement) {
        contradictions.push({
          conflictingEvidenceId: priorMovement.id,
          claimId: movementClaim.id,
          kind: 'time',
          description: 'The witness places TC-9 in Storage Room A at around 2:00 PM, later than the 11:00 AM transfer time in the facilities report. The timing requires reconciliation.',
        })
      }
      challengedAssumptions.push(movementClaim.statement)
    } else if (/corrected the transfer entry|scanned into Room C/i.test(content)) {
      const statement = 'TC-9 was transferred from Storage Room A to Room C at approximately 2:45 PM.'
      claimUpdates.push({ existingClaimId: null, relation: 'supports', statement, relatedPeople: [], relatedEvents: [eventTitle] })
      supportedAssumptions.push(statement)
      changedConclusions.push('The 11:00 AM entry was a scheduled time; the updated record gives an actual transfer time of 2:45 PM.')
    } else if (/transferred from Storage Room A to Room C/i.test(content)) {
      const statement = `TC-9 was transferred from Storage Room A to Room C at ${times[0] ?? 'the time in the movement report'}.`
      claimUpdates.push({ existingClaimId: null, relation: 'supports', statement, relatedPeople: [], relatedEvents: [eventTitle] })
      supportedAssumptions.push(statement)
    } else {
      const statement = `TC-9 movement or location noted on Day ${day}.`
      claimUpdates.push({ existingClaimId: null, relation: 'supports', statement, relatedPeople: people.map((person) => person.name), relatedEvents: [eventTitle] })
    }
  }

  if (warehouse && day === 3) {
    const initial = ctx.priorEvidence.find((e) => /8:00\s?PM/i.test(e.summary) && /delivery/i.test(e.summary))
    if (initial && !contradictions.some((entry) => entry.conflictingEvidenceId === initial.id)) {
      contradictions.push({ conflictingEvidenceId: initial.id, claimId: null, kind: 'time', description: 'The initial witness account places the delivery at approximately 8:00 PM, while the delivery system records completion at 3:42 PM. The sources conflict; neither is treated as conclusive.' })
    }
  }

  if (warehouse && day === 7 && /front office/i.test(content)) {
    const cctv = ctx.priorEvidence.find((e) => /CCTV/i.test(e.title))
    if (cctv && people.some((person) => person.name === 'Person A')) {
      contradictions.push({ conflictingEvidenceId: cctv.id, claimId: null, kind: 'person', description: 'The CCTV report describes a person matching Person A near the loading area around 3:45 PM, while the witness says Person A was at the front office at about that time. The accounts conflict and remain unresolved.' })
      challengedAssumptions.push('Person A was continuously present near the loading area during the delivery window.')
    }
  }

  for (const person of people) {
    if (locations.length) newConnections.push(`${person.name} ↔ ${locations[0]} ↔ ${eventTitle}`)
  }
  if (equipment && locations.length) newConnections.push(`TC-9 ↔ ${locations.join(' ↔ ')}`)

  const scoreFactors: AgentAnalysis['scoreFactors'] = []
  for (const person of people) {
    const relevantText = content.toLowerCase()
    const keys: ScoreFactorKey[] = []
    const placedElsewhere = warehouse && day === 7 && /front office|not in the loading area/i.test(relevantText)
    if (warehouse && day === 1 && /roster|on duty/i.test(content)) keys.push('direct_mention')
    if (!placedElsewhere && (new RegExp(`${person.name}.*(?:entered|accessed|present|observed|near|at the)`, 'i').test(content) || (person.name === 'Person A' && /matching Person A/i.test(content)))) {
      keys.push('location_link')
      if (times.length) keys.push('time_window_link')
    }
    if (placedElsewhere) keys.push('places_elsewhere')
    if (equipment && /access register|access log/i.test(item.title)) keys.push('location_link', 'direct_mention')
    for (const key of [...new Set(keys)]) {
      scoreFactors.push({ person: person.name, factor: key, explanation: `${item.title} states: ${findings[0] ?? content.slice(0, 180)}` })
    }
  }

  const previousBelief = ctx.currentSummary || 'No prior investigation belief; this is the first evidence item.'
  const change = contradictions.length
    ? `${contradictions.length} conflict${contradictions.length === 1 ? '' : 's'} identified between this item and earlier evidence.`
    : `${item.title} adds a new ${item.type.toLowerCase()} record to the investigation state.`
  const caseSummary = [previousBelief, findings.join(' '), contradictions.length ? 'Conflicting accounts remain unresolved; no source is treated as truthful by default.' : 'This item is retained as part of the evolving investigation record.'].filter(Boolean).join(' ').slice(0, 900)

  return {
    summary: findings[0] ?? `${item.type} added: ${item.title}.`,
    findings,
    locations,
    times,
    people,
    events: [event],
    claimUpdates,
    contradictions,
    relationships: [
      ...people.map((person) => ({ source: person.name, target: locations[0] || eventTitle, kind: 'associated with', description: `${person.name} is referenced in ${item.title}.` })),
      ...(equipment ? locations.map((location) => ({ source: 'TC-9', target: location, kind: 'recorded at', description: `${item.title} connects TC-9 with ${location}.` })) : []),
    ],
    scoreFactors,
    whatChanged: {
      previousBelief,
      change,
      impact: contradictions.length ? 'Timeline or account conflict requires investigator review.' : 'Investigation state gains a new evidence-supported event or relationship.',
      supportedAssumptions,
      challengedAssumptions,
      newConnections,
      changedConclusions,
      affectedPeople: people.map((person) => person.name),
      recalledContext: [
        ...ctx.priorEvidence.slice(-2).map((e) => `Day ${e.day}: ${e.title}`),
        ...ctx.recalledMemories.slice(0, 6).map((memory) => `Hindsight recalled: ${memory.text}`),
      ],
    },
    headline: contradictions.length ? 'New evidence challenges the established timeline' : `${item.title} added to investigation memory`,
    hypotheses: contradictions.length ? ['The delivery or movement time may be recorded differently by independent sources.'] : [],
    unresolvedQuestions: contradictions.length ? [contradictions[0].description, 'Which source can independently verify the event time?'] : [],
    caseSummary,
  }
}

function minutesSinceMidnight(value: string) {
  const match = value.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i)
  if (!match) return 0
  let hours = Number(match[1]) % 12
  if (match[3].toUpperCase() === 'PM') hours += 12
  return hours * 60 + Number(match[2] ?? 0)
}