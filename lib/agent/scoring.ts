/**
 * Transparent Evidence Association scoring.
 *
 * The model only chooses WHICH defined factor applies to a person for a piece
 * of evidence and explains why. The weights are fixed here, so every score
 * change can be traced back to a factor + an evidence item.
 *
 * The score expresses how strongly currently available evidence connects a
 * person to the investigated events. It is not a determination of responsibility.
 */

export const SCORE_FACTORS = {
  location_link: {
    label: 'Places person at the investigated location',
    weight: 18,
  },
  time_window_link: {
    label: 'Places person within the relevant time window',
    weight: 10,
  },
  independent_corroboration: {
    label: 'Independent source corroborates an existing connection',
    weight: 8,
  },
  direct_mention: {
    label: 'Person is named in connection with the events',
    weight: 5,
  },
  timeline_inconsistency: {
    label: 'Evidence introduces a timeline inconsistency in the connection',
    weight: -12,
  },
  alternative_explanation: {
    label: 'Evidence points to another person or explanation',
    weight: -8,
  },
  places_elsewhere: {
    label: 'Evidence places person elsewhere during the events',
    weight: -18,
  },
} as const

export type ScoreFactorKey = keyof typeof SCORE_FACTORS

export const SCORE_FACTOR_KEYS = Object.keys(SCORE_FACTORS) as [ScoreFactorKey, ...ScoreFactorKey[]]

export const BASELINE_SCORE = 20

export function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

/** Claim evidence support: derived from counted supporting vs contradicting evidence. */
export function claimSupport(supporting: number, contradicting: number) {
  const confidence = Math.max(5, Math.min(95, 50 + supporting * 15 - contradicting * 20))
  let status: 'supported' | 'challenged' | 'unresolved'
  if (contradicting === 0 && supporting > 0) status = 'supported'
  else if (contradicting > supporting) status = 'challenged'
  else if (supporting > contradicting && contradicting > 0) status = 'supported'
  else status = 'unresolved'
  return { confidence, status }
}
