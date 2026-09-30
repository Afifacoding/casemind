import 'server-only'

import { HindsightClient, HindsightError } from '@vectorize-io/hindsight-client'
import type { MemoryOperation, RecalledMemory } from '@/lib/types'
import { areCaseMemoryBanksIsolated, bankIdForCase, withCaseBank } from './case-scope.mjs'
export { areCaseMemoryBanksIsolated, bankIdForCase } from './case-scope.mjs'

/**
 * Server-only adapter for the official @vectorize-io/hindsight-client SDK.
 * Structured case records remain in DatabaseDataProvider/DemoDataProvider;
 * this module only reads and writes Hindsight investigation memories.
 */
let client: HindsightClient | null = null
let clientConfiguration: string | null = null
const ensuredBanks = new Set<string>()
const operationTotals = new Map<string, { retainedItems: number; recalledMemories: number; reflectionsGenerated: number }>()
const initializedDemoBanks = new Set<string>()

export type HindsightHealth = {
  status: 'connected' | 'not-configured' | 'error'
  detail: string
  apiVersion?: string
}

export type HindsightMemorySnapshot = HindsightHealth & {
  bankId: string
  memories: RecalledMemory[]
  memoryCount: number
  retainedItems: number
  recalledMemories: number
  reflectionsGenerated: number
}

let cachedHealth: { checkedAt: number; configuration: string; result: HindsightHealth } | null = null

export function isHindsightConfigured() {
  return Boolean(getBaseUrl() && process.env.HINDSIGHT_API_KEY?.trim())
}

function getBaseUrl() {
  return process.env.HINDSIGHT_BASE_URL?.trim() || process.env.HINDSIGHT_API_URL?.trim() || ''
}

function getClient() {
  const baseUrl = getBaseUrl()
  const apiKey = process.env.HINDSIGHT_API_KEY?.trim() || ''
  if (!baseUrl || !apiKey) return null
  const configuration = `${baseUrl}\n${apiKey}`
  if (!client || clientConfiguration !== configuration) {
    client = new HindsightClient({
      baseUrl,
      apiKey,
      userAgent: 'casemind/0.1',
    })
    clientConfiguration = configuration
  }
  return client
}

const UNCONFIGURED: MemoryOperation = {
  status: 'unconfigured',
  detail: 'Local demo memory active — Hindsight connection not configured.',
}

function logOperation(operation: 'retain' | 'recall' | 'reflect', bankId: string, suffix = '') {
  if (process.env.NODE_ENV !== 'production') {
    console.info(`[HINDSIGHT] ${operation} ${bankId.replace(/^.*-case-/, 'case-')}${suffix ? ` ${suffix}` : ''}`)
  }
}

function safeFailure(error: unknown): MemoryOperation {
  if (error instanceof HindsightError && error.statusCode) {
    if (error.statusCode === 401) return { status: 'error', detail: 'Authentication was rejected by Hindsight (HTTP 401). Verify the server-side API key.' }
    if (error.statusCode === 403) return { status: 'error', detail: 'Hindsight denied access (HTTP 403). Verify API key permissions.' }
    if (error.statusCode === 404) return { status: 'error', detail: 'Hindsight returned HTTP 404. Verify the base URL and SDK/API compatibility.' }
    if (error.statusCode === 402) return { status: 'error', detail: 'Hindsight returned HTTP 402. Check the account plan or available credits.' }
    if (error.statusCode >= 500) return { status: 'error', detail: `Hindsight service error (HTTP ${error.statusCode}).` }
    return { status: 'error', detail: `Hindsight request failed (HTTP ${error.statusCode}). Check the service configuration.` }
  }
  if (error instanceof TypeError) return { status: 'error', detail: 'Unable to reach the configured Hindsight API. Check network access and the base URL.' }
  return { status: 'error', detail: 'Hindsight request failed. Check the server log for a sanitized diagnostic.' }
}

function totalsFor(bankId: string) {
  let totals = operationTotals.get(bankId)
  if (!totals) {
    totals = { retainedItems: 0, recalledMemories: 0, reflectionsGenerated: 0 }
    operationTotals.set(bankId, totals)
  }
  return totals
}

async function ensureBank(hs: HindsightClient, bankId: string, caseTitle: string) {
  if (ensuredBanks.has(bankId)) return
  await hs.createBank(bankId, {
    name: `CASEMIND — ${caseTitle}`,
    reflectMission: `You are the persistent investigation memory for the fictional CASEMIND case "${caseTitle}". Recall and reflect only on information in this bank. Preserve source attribution, dates, uncertainty, previous assumptions, contradictions, entities, relationships, and state changes. Distinguish reported claims from established facts. Never determine guilt or source truthfulness.`,
    retainMission: `Retain concise, source-attributed investigation memories. Preserve investigation day, evidence identifier and type, the original claim or event, named entities and relationships, timeline details, uncertainty, contradictions, and how the case state changed. Do not infer guilt or decide which conflicting source is truthful.`,
  })
  ensuredBanks.add(bankId)
}

/** A successful SDK version call is the health check; env presence alone is not connected. */
export async function checkHindsightHealth(): Promise<HindsightHealth> {
  const baseUrl = getBaseUrl()
  const hasApiKey = Boolean(process.env.HINDSIGHT_API_KEY?.trim())
  if (!baseUrl || !hasApiKey) {
    cachedHealth = null
    const missing = [!baseUrl ? 'HINDSIGHT_BASE_URL' : '', !hasApiKey ? 'HINDSIGHT_API_KEY' : ''].filter(Boolean).join(' and ')
    if (process.env.NODE_ENV !== 'production') console.info(`[HINDSIGHT] configuration detected: false (${missing} missing)`)
    return { status: 'not-configured', detail: `Hindsight credentials are not configured: ${missing}.` }
  }
  const apiKey = process.env.HINDSIGHT_API_KEY!.trim()
  const configFingerprint = `${baseUrl}\n${apiKey}`
  if (cachedHealth?.configuration === configFingerprint && Date.now() - cachedHealth.checkedAt < 30_000) return cachedHealth.result
  try {
    const hs = getClient()
    if (!hs) return { status: 'not-configured', detail: UNCONFIGURED.detail }
    // getVersion is a useful connectivity probe but the current Hindsight API
    // intentionally permits it without auth. A deterministic bank upsert is
    // the minimal SDK operation that proves the configured API key is accepted.
    const bankId = `${process.env.HINDSIGHT_BANK_PREFIX || 'casemind'}-connection-test`
    const bank = await hs.createBank(bankId, {
      name: 'CASEMIND connection test',
      reflectMission: 'Health-check bank for CASEMIND Hindsight API authentication. No investigation evidence is stored in this bank.',
    })
    if (bank.bank_id !== bankId) throw new Error('Hindsight did not confirm the diagnostic bank identifier.')
    const version = await hs.getVersion()
    const result: HindsightHealth = { status: 'connected', detail: 'Authenticated Hindsight API request succeeded.', apiVersion: version.api_version }
    cachedHealth = { checkedAt: Date.now(), configuration: configFingerprint, result }
    if (process.env.NODE_ENV !== 'production') console.info(`[HINDSIGHT] authenticated health check succeeded (API ${version.api_version}, diagnostic bank confirmed)`)
    return result
  } catch (error) {
    const failure = safeFailure(error)
    const result: HindsightHealth = { status: 'error', detail: failure.detail }
    cachedHealth = { checkedAt: Date.now(), configuration: configFingerprint, result }
    if (process.env.NODE_ENV !== 'production') console.warn(`[HINDSIGHT] health check failed: ${failure.detail}`)
    return result
  }
}

export type RetainItem = {
  content: string
  context: string
  documentId: string
  tags: string[]
  timestamp?: Date
}

export async function retainCaseMemories(
  caseId: number,
  caseTitle: string,
  items: RetainItem[],
): Promise<MemoryOperation> {
  const hs = getClient()
  if (!hs) return UNCONFIGURED
  if (!items.length) return { status: 'skipped', detail: 'No investigation memory facts were provided.' }
  const bankId = bankIdForCase(caseId)
  logOperation('retain', bankId, `items=${items.length}`)
  try {
    const response = await withCaseBank(caseId, async (scopedBankId) => {
      await ensureBank(hs, scopedBankId, caseTitle)
      return hs.retainBatch(
        scopedBankId,
        items.map((item) => ({
          content: item.content,
          context: item.context,
          document_id: item.documentId,
          tags: item.tags,
          timestamp: item.timestamp,
          update_mode: 'replace' as const,
        })),
      )
    })
    if (!response.success) return { status: 'error', detail: 'Hindsight did not confirm the retain operation.' }
    totalsFor(bankId).retainedItems += response.items_count
    return {
      status: 'ok',
      detail: `Hindsight confirmed ${response.items_count} separate investigation memory item${response.items_count === 1 ? '' : 's'} in this case bank.`,
      count: response.items_count,
    }
  } catch (error) {
    const failure = safeFailure(error)
    if (process.env.NODE_ENV !== 'production') console.warn(`[HINDSIGHT] retain failed ${bankId.replace(/^.*-case-/, 'case-')}: ${failure.detail}`)
    return failure
  }
}

export async function recallCaseMemories(
  caseId: number,
  caseTitle: string,
  query: string,
): Promise<{ op: MemoryOperation; memories: RecalledMemory[] }> {
  const hs = getClient()
  if (!hs) return { op: UNCONFIGURED, memories: [] }
  const bankId = bankIdForCase(caseId)
  logOperation('recall', bankId)
  try {
    const response = await withCaseBank(caseId, async (scopedBankId) => {
      await ensureBank(hs, scopedBankId, caseTitle)
      return hs.recall(scopedBankId, query, { budget: 'mid', maxTokens: 2048 })
    })
    const memories = (response.results ?? []).slice(0, 12).map((memory) => ({
      id: memory.id,
      text: memory.text,
      type: memory.type ?? null,
      occurredAt: memory.occurred_start ?? memory.mentioned_at ?? null,
    }))
    totalsFor(bankId).recalledMemories += memories.length
    return {
      op: { status: 'ok', detail: `Recalled ${memories.length} memory result${memories.length === 1 ? '' : 's'} from this case bank.`, count: memories.length },
      memories,
    }
  } catch (error) {
    const failure = safeFailure(error)
    if (process.env.NODE_ENV !== 'production') console.warn(`[HINDSIGHT] recall failed ${bankId.replace(/^.*-case-/, 'case-')}: ${failure.detail}`)
    return { op: failure, memories: [] }
  }
}

export async function reflectOnCase(
  caseId: number,
  caseTitle: string,
  question: string,
): Promise<{ op: MemoryOperation; text: string; sources: RecalledMemory[] }> {
  const hs = getClient()
  if (!hs) return { op: UNCONFIGURED, text: '', sources: [] }
  const bankId = bankIdForCase(caseId)
  logOperation('reflect', bankId)
  try {
    const response = await withCaseBank(caseId, async (scopedBankId) => {
      await ensureBank(hs, scopedBankId, caseTitle)
      return hs.reflect(scopedBankId, question, {
        budget: 'mid',
        includeFacts: true,
        context: 'This is an investigation-support system. Preserve source uncertainty, cite the accumulated case memories, and do not determine guilt or source truthfulness.',
      })
    })
    totalsFor(bankId).reflectionsGenerated += 1
    const sources = (response.based_on?.memories ?? []).map((memory) => ({
      id: memory.id ?? '', text: memory.text, type: memory.type ?? null, occurredAt: memory.occurred_start ?? null,
    }))
    return { op: { status: 'ok', detail: `Hindsight reflected over this case bank using ${sources.length} source memories.`, count: sources.length }, text: response.text, sources }
  } catch (error) {
    const failure = safeFailure(error)
    if (process.env.NODE_ENV !== 'production') console.warn(`[HINDSIGHT] reflect failed ${bankId.replace(/^.*-case-/, 'case-')}: ${failure.detail}`)
    return { op: failure, text: '', sources: [] }
  }
}

export async function listCaseMemories(
  caseId: number,
  caseTitle: string,
  limit = 50,
): Promise<{ health: HindsightHealth; bankId: string; memories: RecalledMemory[]; total: number; metrics: ReturnType<typeof totalsFor> }> {
  const bankId = bankIdForCase(caseId)
  const hs = getClient()
  if (!hs) return { health: { status: 'not-configured', detail: UNCONFIGURED.detail }, bankId, memories: [], total: 0, metrics: { ...totalsFor(bankId) } }
  try {
    const version = await hs.getVersion()
    const response = await withCaseBank(caseId, async (scopedBankId) => {
      await ensureBank(hs, scopedBankId, caseTitle)
      return hs.listMemories(scopedBankId, { limit })
    })
    const memories = (response.items ?? []).map((item) => ({
      id: String(item.id ?? ''),
      text: String(item.text ?? ''),
      type: item.fact_type ?? null,
      occurredAt: item.occurred_start ?? item.mentioned_at ?? null,
    }))
    return {
      health: { status: 'connected', detail: 'Connected to the configured Hindsight service.', apiVersion: version.api_version },
      bankId,
      memories,
      total: response.total,
      metrics: { ...totalsFor(bankId) },
    }
  } catch (error) {
    const failure = safeFailure(error)
    if (process.env.NODE_ENV !== 'production') console.warn(`[HINDSIGHT] case-bank check failed ${bankId.replace(/^.*-case-/, 'case-')}: ${failure.detail}`)
    return {
      health: { status: 'error', detail: failure.detail },
      bankId,
      memories: [], total: 0, metrics: { ...totalsFor(bankId) },
    }
  }
}

/**
 * Retain the preloaded structured case as separate, stable-ID natural-language
 * facts on first case visit. Stable document IDs make this safe across server
 * restarts: the official SDK updates/replaces the same source documents.
 */
export async function initializeDemoCaseMemory(
  caseId: number,
  caseTitle: string,
  items: RetainItem[],
): Promise<MemoryOperation> {
  const bankId = bankIdForCase(caseId)
  if (!getClient()) return UNCONFIGURED
  if (initializedDemoBanks.has(bankId)) return { status: 'skipped', detail: 'Preloaded case memories were already submitted to this bank in this server process.' }

  // Restarting the app must not resend the entire seed bundle to a populated
  // remote bank. Apart from creating duplicates, large retain batches can fail
  // at the service boundary. Inspect actual listed items rather than `total`,
  // which may not be populated consistently by the remote API.
  const existing = await listCaseMemories(caseId, caseTitle, 1)
  if (existing.health.status !== 'connected') {
    return { status: 'error', detail: `Could not check the remote case bank before seeding: ${existing.health.detail}` }
  }
  if (existing.memories.length > 0) {
    initializedDemoBanks.add(bankId)
    return { status: 'skipped', detail: 'Preloaded case memories already exist in the remote bank; duplicate seed retention was skipped.' }
  }

  const result = await retainCaseMemories(caseId, caseTitle, items)
  if (result.status === 'ok') initializedDemoBanks.add(bankId)
  return result
}

export async function deleteCaseBank(caseId: number): Promise<MemoryOperation> {
  const hs = getClient()
  if (!hs) return UNCONFIGURED
  const bankId = bankIdForCase(caseId)
  try {
    await withCaseBank(caseId, (scopedBankId) => hs.deleteBank(scopedBankId))
    ensuredBanks.delete(bankId)
    initializedDemoBanks.delete(bankId)
    operationTotals.delete(bankId)
    return { status: 'ok', detail: 'Deleted the remote Hindsight case bank.' }
  } catch (error) {
    ensuredBanks.delete(bankId)
    initializedDemoBanks.delete(bankId)
    return safeFailure(error)
  }
}
