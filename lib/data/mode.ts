/** PostgreSQL is the default provider, with an explicit local-demo override for reliable demos. */
export function isDatabaseDataMode() {
  const requestedMode = process.env.CASEMIND_DATA_MODE?.trim().toLowerCase()
  if (requestedMode === 'demo' || requestedMode === 'local-demo') return false
  if (requestedMode === 'database' || requestedMode === 'postgres' || requestedMode === 'postgresql') return true
  return Boolean(process.env.DATABASE_URL)
}
