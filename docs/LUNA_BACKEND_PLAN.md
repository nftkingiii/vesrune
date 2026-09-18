# Luna backend execution plan — Vesrune

## 1. Outcome, ownership, and non-goals

Implement a durable Stellar-testnet service for a **yield-funded work account**. The owner deposits capital, realizes earnings, approves a fixed-price task, reviews the delivery, and signs/authorizes its payment. Success means confirmed earnings provenance and a recoverable payment lifecycle, not merely exposing CRUD endpoints.

**Astra:** delivered the frontend preview; returns for actual UI wiring after Luna's handoff. **Luna:** backend, database, integration spike, provider execution, tests, and API examples. Do not start another agent or change the visual design.

Use `server/` as a separate Node/TypeScript package with its own `package.json`, lockfile, `tsconfig.json`, migrations, and `.env.example`. PostgreSQL is authoritative; use a well-supported query layer with parameterized SQL and explicit transactions. Suggested modules:

```text
server/src/
  app.ts, config.ts, health.ts
  auth/         session verification, wallet binding, ownership
  api/          schemas, route handlers, public error mapping
  ledger/       journal, balances, cost basis, reservations
  earn/         provider discovery, quote, reconciliation
  pollar/       verified SDK/server API adapters, capability checks
  operations/   intents, signing coordination, confirmation worker
  work/         task lifecycle, quotes, deliverables
  providers/    allowlisted agent adapters, bounded execution
  policy/       limits, pause, provider allowlists
  receipts/     immutable evidence and safe exports
  workers/      durable outbox, retries, leases, reconciliation
```

Non-goals: mainnet, fiat on/off ramps, DeFindex without credentials, automatic discretionary spending, arbitrary agent marketplaces, guaranteed principal, fabricated interest, and x402 unless a separately verified implementation is explicitly approved. No production deployment in this stage.

## 2. Inputs and source verification

Official starting points: [Pollar docs](https://docs.pollar.xyz), [documentation index](https://docs.pollar.xyz/llms.txt), [full documentation](https://docs.pollar.xyz/llms-full.txt), [React SDK](https://www.npmjs.com/package/@pollar/react), [Core SDK](https://www.npmjs.com/package/@pollar/core), [dashboard](https://dashboard.pollar.xyz).

Research observations from this task (2026-09-16); **revalidate installed versions and signatures before use**:

- React package includes core. `pub_testnet_` public key belongs in the frontend only when Astra wires it; server secret key stays server-side.
- Earn documentation exposes provider/opportunity/position discovery and deposit/withdraw methods: `getEarnProviders`, `getEarnOpportunities`, `getEarnPosition`, `earnDeposit`, `earnWithdraw`, `openEarnModal`. Do not assume a dedicated harvest endpoint exists. Harvest is a reconciled earnings-only withdrawal, not an invented SDK method.
- Classic G-address wallets are the intended first capability path. Passkey C-address smart wallets were documented as not supporting Earn; unsupported wallets must receive a specific actionable error, not an attempted call.
- Email/social wallets have different custody/signing semantics. Do not describe all modes as noncustodial.
- `runTx('payment', …)` was documented for asset payments. SDK success/pending/error is not sufficient evidence to mark the internal ledger settled; verify the transaction and asset movements.
- A server API key does not grant arbitrary end-user signing. Preserve an explicit wallet-signing ceremony. No assumed server-side user key export.
- The inspected app had no keys, origins/callbacks, USDC asset, funded global wallet, or enabled Earn pool configured. The dashboard app is currently named Keke; the product is now Vesrune. Do not rename or configure the dashboard without direction.
- Earn opportunities visible under TestNet are **not proof** that selected contracts/assets execute there. Never silently use a mainnet address or mainnet issuer.
- Documentation did not establish native x402 support. Plain agent service payment over Stellar is sufficient; name it accurately.

Milestone zero must record exact resolved package versions, supported wallet type, network passphrase, RPC endpoint, asset code+issuer, pool contract, and observed ledger. Do not copy the user's keys into documentation or terminal output.

## 3. Milestones and stop conditions

### M0 — Capability spike before the financial backend

1. Inspect current SDK exports/types and official docs, with dependency scripts disabled initially. Record versioned source links.
2. Read provider opportunities and selected pool configuration on the actual testnet RPC. Verify the exact USDC issuer, trustline requirements, token contract, pool asset, and wallet support. An asset code alone never identifies USDC.
3. Create a manual, dry-run-first harness for deposit quote/simulation → user-authorized signature → confirmation → position read-back → user-authorized small withdrawal → read-back. Keep signing out of logs.
4. Before any write, obtain the user's network, wallet, exact asset, amount, pool/destination, and action approval. Neither the old research request nor an API key supplies that authorization.
5. If write authorization or required app configuration is unavailable, continue with backend contracts and mock adapter tests. Label real execution unverified. If the pool itself is unavailable, do not claim yield integration complete.

**Pass:** exact testnet path proven with confirmed hashes and read-back, or an explicit blocked capability report and fail-closed live adapter. Missing access should not prevent implementing the durable backend and tests.

### M1 — Foundation, sessions, and ownership

Implement config validation, health/readiness, Postgres migrations, schema validation, stable error codes, and request IDs. Pin one backend package manager and frozen installs. Validate network is `stellar-testnet` at boot; mainnet configuration must fail.

Verify a Pollar-issued user token through the documented verification mechanism, then issue a short-lived Secure/HttpOnly/SameSite session cookie. Bind workspace and wallet to the verified subject, not to a client-provided owner ID. No token in localStorage. If wallet ownership needs an additional signed challenge, use nonce, domain, network, expiry, one-use verification, and replay protection. Document any required auth UX for Astra; do not build a competing login UI.

Protect every object read/write by owner/workspace. CSRF protection for cookie-authenticated writes; exact origin allowlist; request body size limits; rate limits; security headers; redact secrets and signed payloads.

**Pass:** two-user isolation tests, replay/expired token rejection, unauthorized requests denied, health distinguishes database readiness from upstream capability availability.

### M2 — Ledger and reservations

Use immutable double-entry journal lines for actual money, separate reservation records for allocation holds, and derived balances. Required tables (adapt names, preserve semantics):

| Table | Required invariants |
| --- | --- |
| users, workspaces, wallet_bindings | Verified subject; owner FK; network; no private keys |
| assets, earn_positions | Code+issuer+network identity; shares; capital basis; observation ledger/time |
| journal_entries, journal_lines | Balanced asset-level postings; immutable; unique external event ID |
| policies | Revision; caps; pause; provider IDs; owner approval always required |
| tasks, task_events | Immutable budget/recipient once approved; legal state transitions |
| reservations | One active reservation per task; amount; release/consume exactly once |
| deliveries | Task/provider binding; content digest; validation; owner review evidence |
| operations, transaction_attempts | Stable intent; signed transaction hash; network; lifecycle; no blind retry |
| idempotency_keys | Owner+route+key uniqueness; request digest; response/operation reference |
| outbox_jobs | Durable job identity, retries, lease expiry, worker ownership |
| receipt_events | Confirmed provenance, ledger, hash, accounting links; append-only |

Amounts: use SQL `numeric(30,7)` or bounded integer minor units; JavaScript BigInt/decimal arithmetic internally. Wire amounts are canonical decimal strings. Reject floats, exponent strings, negative/overflow, wrong issuer, and too many decimals. Preview `number` amounts are not backend authority.

Approval transaction: lock account/policy and affected task; recompute available realized earnings; validate allowlist/caps/pause and revision; insert reservation and event atomically. Open reservations consume today's headroom regardless of when created, plus payments settled today (UTC). Avoid counting a payment twice while a reservation is consumed. Persist this exact policy and test midnight boundaries. Serializability/row locks must prevent two requests allocating the same earnings.

Idempotency: same key+same payload returns the original operation/result; same key+different payload is 409. Scope keys to authenticated owner and operation. A client timeout never justifies a new payment intent.

**Pass:** concurrent approvals cannot overspend; retries cannot duplicate; all failure paths roll back atomically; policy update cannot race settlement undetected.

### M3 — Earn accounting and realized-earnings provenance

Maintain deposited capital basis, share movements, current conservative redeemable value, unrecovered losses, and realized net earnings separately. The simplified `vaultValue - principal` preview is NOT the production cost-basis algorithm.

Required behavior:

- A deposit increases capital basis, not work budget. A capital withdrawal returns capital, not income.
- Partial withdrawals allocate basis consistently at the share/lot level. Specify and test the accounting method before coding. Don't double-count transferred/deposited gains.
- Recover previous losses before recognizing new distributable earnings under the chosen high-water-mark rule. External transfers, rebases, ambiguous events, or stale quotes freeze recognition until reconciled.
- A harvest intent is an earnings-only withdrawal bounded by conservative realized gain after expected fees/slippage and minimum capital basis. Simulation is not settlement.
- Credit the work balance only after confirmed transaction, exact net proceeds, source pool/share reconciliation, and account/asset read-back. Display estimated gain separately.
- Fees in XLM require a separate fee reserve and exact quote; don't debit task capital silently. An uncertain fee or insufficient reserve blocks signing.
- Reject unavailable liquidity, stale ledger, unsupported wallet, wrong network, wrong issuer, loss state, and expired quote explicitly.

**Enforcement decision:** Use an application-enforced realized-earnings ledger plus owner-signed payments for the first integration, backed by a dedicated, verifiably segregated realized balance where the SDK supports it. Do not pretend arbitrary user-wallet transfers are prevented by app policy. If strong principal isolation needs a custom vault/controller or server custody not provided by Pollar, stop and present the trade-off for approval. Do not introduce custody or deploy a contract silently.

**Pass:** no path classifies principal, an inbound transfer, unconfirmed yield, or a recovered loss as spendable profit. Real pool execution stays capability-gated until M0 proof exists.

### M4 — Work lifecycle and real provider adapter

Task state machine:

```text
requested -> approved (reserve) -> running -> delivered -> payment_pending -> paid
requested/approved/running/delivered -> cancelled (release, only if no payment in flight)
running -> failed (release per verified provider outcome)
delivered -> disputed (keep funds reserved until resolved)
payment_pending -> reconcile until definitive success/failure; never cancel to free it blindly
```

Choose one bounded provider first (e.g., source-grounded text brief or draft review). Templates are not three implemented integrations. Quote the real service cost separately from the preview price. Do not turn a test provider into fake production output.

Providers cannot choose payout address or amount through their result text. Registry entries bind provider ID, validated destination, asset/network, service endpoint, pricing, max duration, request schema, and result schema. Task budget and recipient are immutable after approval; a changed quote requires renewed owner approval.

Execute through durable jobs and an allowlisted adapter with request timeout, limited retries, response size cap, token/usage cap, and idempotency. Model output is untrusted escaped text; never `eval`, HTML, SQL, shell, or wallet arguments. If sources are fetched, use a strict allowlist and pinned/resolved public-IP validation, reject private/link-local/metadata targets and redirects; do not accept arbitrary user URLs by default.

Persist the delivery and SHA-256 of its canonical bytes, bind it to task/provider, then ask the owner to accept. No provider callback or model tool call may approve or pay. Cancellation during running work needs an explicit provider cancellation policy to avoid paying for invisible work later.

**Pass:** one actual provider delivers through the service; adversarial output cannot change policy/recipient/budget; owner rejection/cancellation behaves correctly; mock providers remain separately labeled.

### M5 — Signing, payment, recovery, receipts

1. Accepting a delivery records an approval bound to delivery digest, exact task quote, asset, recipient, owner, policy revision, and expiry.
2. Recheck fresh earnings/reservation, fee balance, caps, pause, allowlist, wallet capability, and network.
3. Prepare an expiring intent/quote for the documented Pollar wallet signing path. Astra will implement the browser ceremony. Do not invent a server `signForUser` endpoint.
4. Record the exact transaction hash/network before or atomically with submission tracking. The user signature must be bound to approved operation contents; parse and verify submitted envelope effects, not just a caller-provided hash.
5. Worker polls transaction/ledger and reconciles matching sender, recipient, code+issuer, amount, memo/intent binding, ledger/time, success, and no unrelated operations. Unknown/pending states retain the reservation.
6. Only definitive confirmed settlement consumes the reservation and books the payment. Definitive rejection/expiry may return to delivered/retryable state. Preserve a rejection receipt/event.
7. Crash recovery resumes the existing transaction/intention. Never generate a fresh payment after timeout without checking the old hash; Stellar sequence numbers alone are not business idempotency.

Receipt includes operation/task/delivery digest, network, code+issuer, sender/recipient, decimal amount, fee, submitted/confirmed timestamps, transaction hash, confirmed ledger, exact journal references, and provenance. Derive explorer URL from an allowlisted network base, not an external input. Pending receipt is visibly pending; no invented hashes.

**Pass:** crash-after-submit, repeated callback, response timeout, duplicate acceptance, wrong recipient, wrong asset, reorg/uncertain state, and worker concurrency tests preserve one payment maximum.

## 4. API contract

`shared/api.ts` is the proposed live response model. The existing `shared/contracts.ts` models local preview state; **do not return `mode: preview` for actual money and do not cast a testnet response into it**. Astra will add a discriminated UI model and map pending/error/capability states during wiring. Keep serializable decimal strings and return documented error objects.

Suggested routes:

| Method / path | Semantics |
| --- | --- |
| `GET /healthz` | Build revision and process health; no secrets |
| `GET /readyz` | DB/migration readiness and redacted upstream capability status |
| `POST /v1/auth/session` | Verify Pollar token and set protected session cookie |
| `DELETE /v1/auth/session` | Revoke current session |
| `GET /v1/workspace` | `LiveSnapshot`, authoritative balances/revision/capabilities |
| `PATCH /v1/workspace` | Validated workspace name only |
| `GET /v1/earn/opportunities` | Verified network/asset/provider results; reason codes if unavailable |
| `POST /v1/earn/quotes` | Deposit/withdraw/harvest `Quote`; no write |
| `POST /v1/operations` | Quote-bound signing intent; idempotent, no unapproved signature |
| `GET /v1/operations/:id` | `Operation` including pending/confirmed/error state |
| `POST /v1/operations/:id/submission` | Bind/verify signed submission or SDK hash via exact effect verification |
| `GET /v1/providers` | Allowed, actually implemented service catalog |
| `POST /v1/tasks` | Validate brief, provider and fixed quote; create request |
| `GET /v1/tasks` | Search/status/cursor pagination |
| `GET /v1/tasks/:id` | Owned task and delivery |
| `POST /v1/tasks/:id/approve` | Transactional reserve + durable execution job |
| `POST /v1/tasks/:id/cancel` | Safe cancellation/release with payment-in-flight guard |
| `POST /v1/tasks/:id/accept` | Delivery-digest-bound acceptance + payment quote/intent |
| `POST /v1/tasks/:id/reject` | Reject/dispute delivery; documented release policy |
| `PATCH /v1/policy` | Versioned owner-only policy update, audit event |
| `GET /v1/receipts` | Cursor/type/date/task filtering |
| `GET /v1/receipts/export` | Owner-scoped JSON export, capped size |

Mutating business requests require `Idempotency-Key` and `expectedRevision` (or documented If-Match). Quote IDs bind immutable parameters. Error codes at minimum: `UNAUTHENTICATED`, `FORBIDDEN`, `VALIDATION_ERROR`, `REVISION_CONFLICT`, `IDEMPOTENCY_CONFLICT`, `WRONG_NETWORK`, `UNSUPPORTED_WALLET`, `POOL_UNAVAILABLE`, `STALE_POSITION`, `INSUFFICIENT_EARNINGS`, `INSUFFICIENT_FEE_RESERVE`, `POLICY_PAUSED`, `TASK_CAP`, `DAILY_CAP`, `PROVIDER_BLOCKED`, `INVALID_TRANSITION`, `QUOTE_EXPIRED`, `SIGNATURE_REJECTED`, `TRANSACTION_PENDING`, `RECONCILIATION_REQUIRED`, `PROVIDER_FAILED`.

Do not expose `previewDeliver`, `previewPool`, reset/seed, or arbitrary balance writes in live routes. Test fixtures need an isolated test database/environment.

## 5. Test matrix and readiness gates

Port the intent of the 33 frontend ledger tests, not the simplified implementation. Add:

- Authentication: two-user isolation across tasks, receipts, quotes, wallets; session expiry/CSRF/token replay.
- Accounting: zero gain, negative gain, partial withdrawals, loss then recovery, deposit after loss, external transfer, stale prices, seven-decimal dust, overflow, gas fees, wrong issuer.
- Concurrency: simultaneous reservations, policy race, repeated requests, same key/different payload, midnight limits, cancellation vs payment, two workers handling one job.
- Chain: rejected signature, expired quote, submitted/pending/confirmed/failure, RPC downtime, process crash after broadcast, exact effect/hash read-back mismatch, duplicate transaction observation.
- Agent: timeout, malformed output, oversized response, prompt injection requesting payment or secrets, redirects/private IP, repeated callback, cancelled task returns late result.
- Product: empty account, unsupported wallet, no pool liquidity, insufficient realized funds, stale reconciliation, paused account, unavailable provider, user rejection. Every state has a public error/capability reason for the UI.
- A small held-out real provider suite: at least five representative briefs, repeated runs; record success/unsafe output/latency/cost and citations quality where relevant. No unmeasured reliability claims.

Definition of backend done: migrations reproducible; tests/build/typecheck/audit pass; no secrets in tracked files/logs; endpoints documented with sample redacted responses; server starts clean with missing optional integrations disabled; actual proven capabilities have primary evidence; all remaining unverified paths explicitly listed.

## 6. Configuration and final handoff

Required variable names depend on verified SDK, but document at least: `DATABASE_URL`, `SESSION_SECRET`, `ALLOWED_ORIGINS`, `STELLAR_NETWORK`, `STELLAR_RPC_URL`, selected asset issuer and pool ID, server-only Pollar key if actually required, and any provider API key. Never put secret values in `VITE_` variables. Root frontend currently needs no environment values.

In `docs/BACKEND_HANDOFF.md`, provide:

1. Changed files and install/migrate/start/test commands.
2. Exact dependency versions, endpoint paths, auth/signing sequence, CORS/origin requirements.
3. Example `LiveSnapshot`, quote, operation, error, and receipt JSON with no credentials.
4. Which SDK calls happen in browser vs server, and any wire-contract additions Astra must implement.
5. Test output and known limitations, with fixture/mock/live evidence separated.
6. Verified testnet pool/asset/wallet details and confirmed public transaction/read-back evidence **only if actually executed with authorization**.
7. Astra wiring checklist: adapter selection, auth provider, amount conversion, pending operation polling, safe retry, receipt links, no preview fallback, real provider catalog, blocked-capability copy.

Stop after this handoff. The user will tell Astra when to integrate. Do not deploy publicly, submit to the hackathon, or claim the full product is live.
