# CASEMIND — Evidence Continuity Agent

CASEMIND is an investigation-support prototype that preserves case-local evidence, claims, people, events, relationships, contradictions, updates, and explainable Evidence Association Scores as an investigation evolves. It surfaces what changed and why a claim or connection is currently supported or challenged. It does not determine guilt; investigators remain responsible for decisions.

All preloaded names, organizations, and events are fictional demonstration data. Added evidence should also be synthetic unless the application is deployed with appropriate security, access controls, and retention policies for real investigative material.

## Technology

- Next.js App Router, React, TypeScript, Tailwind CSS
- PostgreSQL with Drizzle ORM
- Vercel AI SDK for optional LLM-backed evidence analysis
- Official `@vectorize-io/hindsight-client` package (currently locked to 0.10.1) for optional Hindsight Cloud/self-hosted memory
- Recharts dependency is retained from the prototype; score histories are currently rendered as accessible inline SVG charts

## Architecture

```text
User
  ↓
CASEMIND UI (case-specific evidence, timelines, memory, explanations)
  ↓
Investigation API / Agent
  ├─ Recall case context (Hindsight when configured; structured local/DB state always)
  ├─ Analyze evidence (LLM when configured; deterministic demo analyzer otherwise)
  ├─ Update case-scoped structured state in PostgreSQL or the local demo provider
  └─ Retain the evidence and state change in Hindsight when configured
  ↓
Investigation State
  ├─ WHAT CHANGED?
  └─ WHY DO WE BELIEVE THIS?
```

**CASEMIND** owns application and investigation logic. The **LLM** extracts and reasons over evidence only when an AI Gateway credential is configured. **Hindsight** is a separate optional persistent memory provider using the official SDK; it is never simulated. With `DATABASE_URL`, **PostgreSQL/Drizzle** is structured state. Without it, **DemoDataProvider** supplies fictional process-local state. Hindsight stores human-readable investigation memories only; it does not replace either structured-state provider. A Hindsight connection is reported only after an authenticated SDK request creates/updates the deterministic `casemind-connection-test` diagnostic bank and the SDK version request succeeds; case views additionally list the selected case bank. When unavailable, CASEMIND continues with local/structured case state and labels Hindsight unavailable.

Each Hindsight bank ID is derived from a prefix and the case's unique slug. Every structured query in the agent and case pages is filtered by `caseId`. Demo cases have different evidence, extracted people, entities, relationships, and Hindsight banks.

## Local setup

Requirements: Node.js supported by the installed Next.js version and pnpm. PostgreSQL is optional for local demo mode and required only when selecting the database provider.

1. Install dependencies with `pnpm install`.
2. To run the local demo, leave `DATABASE_URL` unset. Both fully populated fictional cases load automatically in process-local memory.
3. For PostgreSQL mode, copy `.env.example` to `.env.local`, set `DATABASE_URL` to a PostgreSQL database you control, and apply the initial schema from the repository root. In PowerShell:

   ```powershell
   psql $env:DATABASE_URL -f lib/db/schema.sql
   ```

   Set `$env:DATABASE_URL` in the terminal first, or pass the connection string directly to `psql` without committing it.
4. Start the development server with `pnpm dev`.
5. Open the CASEMIND entry at `/` or `/login`. Select **ENTER DEMO ENVIRONMENT** to start a marked local demo session, or configure investigator credentials below to use the three-factor investigator login.

Provider selection is automatic: if `DATABASE_URL` is set, the existing PostgreSQL provider is used; if absent, the in-memory demo provider is used. Local demo edits last only for the current server process and must not be treated as persistent records.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | No | PostgreSQL connection string for structured application state; omit for process-local demo mode. |
| `CASEMIND_INVESTIGATOR_ID` | Required for investigator login | Investigator identifier; default example is `investigator@casemind.local`. |
| `CASEMIND_ACCESS_KEY` | Required for investigator login | Server-validated access key. Replace the `.env.example` placeholder. |
| `CASEMIND_TOTP_SECRET` | Required for investigator login | Base32 secret for a standard 6-digit SHA-1 TOTP authenticator, 30-second period. Never expose it to the browser. |
| `CASEMIND_SESSION_SECRET` | Required in production | At least 32 random characters used to sign the HttpOnly session cookie. Local development has a stable demo-only fallback if omitted; never use that fallback in production. |
| `AI_GATEWAY_API_KEY` | No | Enables model-backed analysis through the Vercel AI SDK AI Gateway. Without it, the clearly labeled deterministic demo analyzer is used. |
| `CASEMIND_MODEL` | No | Gateway model identifier; defaults to `openai/gpt-5-mini`. |
| `HINDSIGHT_BASE_URL` | No | Hindsight base URL from the Connect page; Hindsight Cloud uses `https://api.hindsight.vectorize.io`. For self-hosted Hindsight, use its configured base URL. |
| `HINDSIGHT_API_KEY` | No | Server-side Hindsight API key; required by Hindsight Cloud and sent by the official SDK as a Bearer token. Some self-hosted deployments allow no key. |
| `HINDSIGHT_API_URL` | No | Legacy alias, used only when `HINDSIGHT_BASE_URL` is unset. |
| `HINDSIGHT_BANK_PREFIX` | No | Prefix for deterministic numeric case banks; defaults to `casemind`, producing `casemind-case-1`, `casemind-case-2`, etc. |

`.env.example` contains placeholders only. Local `.env*` files are ignored by Git. Never commit real credentials.

### Configure investigator access and TOTP

1. Copy `.env.example` to `.env.local` (already ignored by Git).
2. Set `CASEMIND_ACCESS_KEY` to a private value and set `CASEMIND_SESSION_SECRET` to a unique random string of at least 32 characters. A PowerShell example for the session secret is:

  ```powershell
  node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
  ```

3. Generate a standard 160-bit Base32 TOTP secret with the installed OTPAuth library, then paste the output directly into the ignored `.env.local` file:

  ```powershell
  node --input-type=module -e "import * as OTPAuth from 'otpauth'; console.log(new OTPAuth.Secret({size:20}).base32)"
  ```

  Do not paste the generated secret into chat or source code. In an authenticator app, add an account manually using issuer `CASEMIND`, the configured investigator identifier, the Base32 secret, SHA1, 6 digits, and a 30-second period. Any standards-compliant TOTP authenticator then generates the current Investigator Code from Unix time. The login screen intentionally does not reveal codes, secrets, time hints, or countdowns.
  For local testing only, the installed OTPAuth library can print the current code from the ignored environment file (the code changes every 30 seconds):

  ```powershell
  node --env-file=.env.local --input-type=module -e "import * as OTPAuth from 'otpauth'; const t = new OTPAuth.TOTP({secret:OTPAuth.Secret.fromBase32(process.env.CASEMIND_TOTP_SECRET),digits:6,period:30}); console.log(t.generate())"
  ```

  Treat this output like an authenticator code; do not paste it into chat or commit it.
4. Restart `pnpm dev`. Submit the exact identifier, access key, and current 6-digit authenticator code. Codes are validated on the server with a ±1 time-step window.

Login stores no credentials in browser storage. The server checks the exact configured identifier/access key and verifies the six-digit TOTP with a one-step (±30 second) tolerance. Failures use the same generic message. Successful investigator authentication creates a signed, 12-hour `HttpOnly`, `SameSite=Lax` session cookie (`Secure` in production). In production, a missing/placeholder session secret fails closed. The demo button creates a separate, visibly labeled demo session without requiring investigator credentials. This demo mode intentionally bypasses investigator authentication and is only suitable for the hackathon demonstration; disable it or put the app behind deployment access controls before exposing a real deployment.

Unauthenticated `/dashboard` and `/cases/*` requests are redirected to `/login` by Next.js 16 Proxy and re-checked in each protected page and Server Action. The session contains only its mode, issuance/expiry time, and random nonce; it contains no identifier, access key, or TOTP secret.

## Demo cases

- **Warehouse Theft Investigation** — five sequenced fictional evidence items across Days 1, 3, 5, 6, and 7. The Day 1 approximately 8:00 PM account conflicts with the later 3:42 PM delivery record and afternoon access/CCTV/witness timeline. The Day 7 account also challenges the interpretation of Person A's location; no source is automatically treated as truthful.
- **Missing Equipment Investigation** — six different fictional items tracing thermal camera TC-9 between Storage Room A and Room C. The Day 5 witness challenges the scheduled 11:00 AM movement entry; the Day 6 corrected inventory explains that it was a scheduled time and records the actual 2:45 PM transfer.

Use **Process next** to run the evidence sequence in investigation-day order. You can also add a new evidence item; it is analyzed and associated only with the selected case. **Reset demo** restores that demo case's evidence and attempts to clear only its own Hindsight bank.

## Memory and analysis behavior

When configured, opening a demo case creates/checks its Hindsight bank and retains its preloaded sequence as separate human-readable facts: source-attributed evidence content, individual findings/times/locations/people, events, relationships, claims, contradictions, score changes, and investigation updates. Stable document IDs allow the same preloaded facts to be safely replaced on a later server start instead of appended repeatedly.

Evidence processing runs the following case-scoped flow:

1. Recall relevant Hindsight memories before processing the new item when configured.
2. Load prior evidence, claims, people, and events from the selected case's PostgreSQL records.
3. Analyze the new evidence with the configured model, or use the deterministic offline analyzer for fictional demo data when the provider is not configured or is unavailable.
4. Update evidence analysis, claims, events, people, relationships, contradictions, score history, and investigation updates in the selected structured-state provider.
5. Retain separate source/fact/entity/event/relationship/claim/contradiction/score/state-change memories in the selected case's Hindsight bank when configured.
6. Display the actual structured update, score factors, timeline, and memory operation status in the case workspace.

The deterministic analyzer is an offline demonstration fallback, not an LLM and not a replacement for expert review. Hindsight calls are made through the installed official client. RETAIN runs after evidence processing and for investigator contradiction-status changes; RECALL runs before new evidence processing; REFLECT runs only when the user submits a reflection question. Each API operation accepts a numeric case ID and derives its own `casemind-case-<id>` bank inside the server-only adapter. Unit tests verify IDs differ and the recall dispatch uses only the selected bank. Reflect source memories are shown with the answer. If no Hindsight URL is configured or a real SDK health/API call fails, the UI reports “Local demo memory active — Hindsight connection unavailable.”

Evidence Association Score is a deterministic 0–100 evidence-connection index with fixed weights and per-event factor explanations. It represents current evidence connection strength and is not a determination of responsibility. Contradictions default to **Unresolved**; an investigator can mark them **Investigating**, **Explained**, or **Resolved**. A correction record may explain a specific discrepancy, but the system does not decide a person's truthfulness.

## Checks

- `pnpm typecheck` — TypeScript check.
- `pnpm build` — production build (TypeScript build errors are not suppressed).
- `pnpm test:memory` — verifies deterministic case bank separation and case-scoped recall dispatch using Node's built-in test runner.
- `pnpm test:auth` — verifies factor validation, TOTP window behavior, session signatures/expiry, protected-route policy, demo-session wiring, and that auth secrets do not enter the client UI.

The local synthetic demo works without PostgreSQL; PostgreSQL mode requires the configured database and schema. Hindsight and model credentials are optional for the deterministic synthetic demonstration flow. To enable real Hindsight Cloud memory, create an API key in the Hindsight Connect page, put it in server-only `.env.local` with `HINDSIGHT_BASE_URL=https://api.hindsight.vectorize.io`, restart the Next.js server, and open each case once to initialize/verify its separate bank. No credential is provided or committed by this repository.
