export function bankIdForCase(caseId: number): string
export function areCaseMemoryBanksIsolated(firstCaseId: number, secondCaseId: number): boolean
export function withCaseBank<T>(caseId: number, operation: (bankId: string) => Promise<T>): Promise<T>
