/** Deterministic Hindsight namespace and one helper for case-scoped SDK calls. */
export function bankIdForCase(caseId) {
  if (!Number.isSafeInteger(caseId) || caseId < 1) throw new Error('Hindsight requires a positive numeric case ID.')
  const prefix = process.env.HINDSIGHT_BANK_PREFIX || 'casemind'
  return `${prefix}-case-${caseId}`
}

export function areCaseMemoryBanksIsolated(firstCaseId, secondCaseId) {
  return bankIdForCase(firstCaseId) !== bankIdForCase(secondCaseId)
}

export function withCaseBank(caseId, operation) {
  return operation(bankIdForCase(caseId))
}
