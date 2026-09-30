import assert from 'node:assert/strict'
import { test } from 'node:test'
import { areCaseMemoryBanksIsolated, bankIdForCase, withCaseBank } from '../lib/memory/case-scope.mjs'

test('case IDs resolve to deterministic, distinct Hindsight banks', () => {
  const previousPrefix = process.env.HINDSIGHT_BANK_PREFIX
  delete process.env.HINDSIGHT_BANK_PREFIX
  try {
    assert.equal(bankIdForCase(1), 'casemind-case-1')
    assert.equal(bankIdForCase(2), 'casemind-case-2')
    assert.notEqual(bankIdForCase(1), bankIdForCase(2))
    assert.equal(areCaseMemoryBanksIsolated(1, 2), true)
  } finally {
    if (previousPrefix === undefined) delete process.env.HINDSIGHT_BANK_PREFIX
    else process.env.HINDSIGHT_BANK_PREFIX = previousPrefix
  }
})

test('each recall is dispatched only to its own Hindsight bank', async () => {
  const memories = new Map([
    ['casemind-case-1', ['Warehouse witness: delivery was approximately 8:00 PM.']],
    ['casemind-case-2', ['TC-9 was last recorded in Storage Room A.']],
  ])
  const fakeClient = {
    async recall(bankId) {
      return { results: (memories.get(bankId) ?? []).map((text, index) => ({ id: `${bankId}-${index}`, text })) }
    },
  }

  const recallFor = (caseId) => withCaseBank(caseId, (bankId) => fakeClient.recall(bankId))
  const [warehouse, equipment] = await Promise.all([recallFor(1), recallFor(2)])

  assert.deepEqual(warehouse.results.map((memory) => memory.text), ['Warehouse witness: delivery was approximately 8:00 PM.'])
  assert.deepEqual(equipment.results.map((memory) => memory.text), ['TC-9 was last recorded in Storage Room A.'])
  assert.equal(equipment.results.some((memory) => memory.text.includes('Warehouse')), false)
  assert.equal(warehouse.results.some((memory) => memory.text.includes('TC-9')), false)
})

test('invalid case IDs cannot create an unscoped Hindsight bank', () => {
  assert.throws(() => bankIdForCase(0), /positive numeric case ID/)
  assert.throws(() => bankIdForCase(-1), /positive numeric case ID/)
  assert.throws(() => bankIdForCase(Number.NaN), /positive numeric case ID/)
})
