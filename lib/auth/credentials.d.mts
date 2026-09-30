export const INVALID_CREDENTIALS_MESSAGE: string
export type CredentialInput = { identifier: unknown; accessKey: unknown; investigatorCode: unknown }
export type CredentialConfig = { identifier: string | undefined; accessKey: string | undefined; totpSecret: string | undefined }
export function verifyInvestigatorCredentials(input: CredentialInput, config: CredentialConfig, now?: number): boolean
