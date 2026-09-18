# Vesrune backend handoff

Status: backend foundation is implemented for Astra integration. This is not a connected testnet DApp. No wallet, Pollar account, yield pool, provider, or blockchain write was executed.

## Changed files

- `server/package.json`, `server/package-lock.json`, `server/tsconfig.json`, `server/.npmrc`, `server/.env.example`
- `server/migrations/001_initial.sql`
- `server/src/config.ts`, `errors.ts`, `decimal.ts`, `http.ts`, `server.ts`, `migrate.ts`
- `server/src/policy.ts`, `server/src/ledger/service.ts`, `server/src/pollar/capabilities.ts`
- `server/test/decimal.test.ts`, `ledger.test.ts`, `http.test.ts`

No `src/**` file was changed.

## Reproducible commands

From `server/`:

```sh
npm ci
npm run typecheck
npm run test
npm run build
npm audit --omit=dev
npm run migrate
npm start
```

The server requires the variables in `server/.env.example`. It refuses non-`stellar-testnet` configuration and refuses to start with a short session secret. `npm ci` uses the isolated server lockfile; lifecycle scripts are disabled in `server/.npmrc`.

## Current HTTP boundary

- `GET /healthz` returns process health and a request ID.
- `GET /readyz` returns HTTP 503 while PostgreSQL/upstream capability wiring is unavailable, with redacted capability reason codes.
- `GET /v1/earn/opportunities` returns an empty catalog and `POLLAR_NOT_CONFIGURED` / `REAL_EXECUTION_UNVERIFIED` capability reasons.
- `POST /v1/auth/session` fails closed with `UNAUTHENTICATED` until a verified Pollar-token adapter is configured.

The remaining routes are intentionally not exposed as fake CRUD or fake payment endpoints. The next implementation slice should connect the SQL repository and verified Pollar token/read-back adapters before enabling them.

## Accounting and safety foundation

Amounts are canonical decimal strings and are parsed as integer 7-decimal units; exponent notation, negatives, floats, excess precision, and overflow are rejected. The ledger service tests reserve only realized earnings, enforce pause/provider/task/daily policy, use explicit task transitions, release cancellation reservations, and settle exactly once. The SQL migration includes immutable journal tables, asset identity `(network, code, issuer)`, earn cost-basis fields, reservations, operations, idempotency keys, outbox jobs, and append-only receipt events.

The HTTP layer applies request IDs, body-size limits, JSON validation, and baseline security headers. No private keys, Pollar secrets, signed payloads, or client owner IDs are accepted as authority in this slice.

## Pollar capability spike evidence

Official documentation was revalidated from `https://docs.pollar.xyz/llms-full.txt` on 2026-09-17. It documents `getEarnProviders`, `getEarnOpportunities(provider)`, `getEarnPosition(params)`, `earnDeposit(params)`, and `earnWithdraw(params)`. It also states that Pollar Server does not move user funds and that user signing remains an explicit wallet boundary.

Installed package inspection: `npm view @pollar/core` resolved latest `0.11.3`, with types at `dist/index.d.ts`; it was not installed because no verified app key, selected testnet pool, asset issuer, funded wallet, or user write authorization was available. Therefore no live Pollar adapter is enabled and no deposit → position read-back → withdrawal evidence exists.

Unverified items: exact testnet pool/contract, exact configured USDC issuer for this app, wallet support for the selected pool, trustline/liquidity, real provider endpoint, Pollar token verification endpoint details, real RPC reads, and any transaction hash/read-back.

## Astra integration checklist

1. Add a discriminated live API model mapped from `shared/api.ts`; do not cast responses into `mode: 'preview'`.
2. Supply the browser Pollar publishable-key/auth provider and send the resulting short-lived token to `POST /v1/auth/session`; the server will bind workspace/wallet to the verified subject.
3. Add CSRF/origin handling for cookie-authenticated mutations and send `Idempotency-Key` plus `expectedRevision` on every mutating business request.
4. Keep amounts as decimal strings at the wire boundary; convert to preview units only in the UI adapter.
5. Implement the user wallet signing ceremony for quote-bound operations. Do not add a server-side `signForUser` assumption.
6. Poll operation status and preserve `awaiting_signature`, `pending`, and `reconciling` states. Retry by operation ID, never by creating a second payment.
7. Display capability reason codes and blocked states; do not fall back to preview data for live errors.
8. Wire receipt links only from allowlisted network bases after confirmed transaction/read-back.

## Verification snapshot

- Backend: `npm run test` — 4 files, 13 tests passed.
- Backend: `npm run typecheck` — exit 0.
- Backend: `npm run build` — exit 0.
- Backend: `npm audit --omit=dev` — 0 vulnerabilities reported.
- Root frontend: `npm run typecheck` — exit 0; `npm test` — 6 files, 50 tests passed; `npm run build` — exit 0.

These are local fixture/unit/HTTP-boundary checks, not live financial evidence. PostgreSQL migration execution, Pollar verification, provider delivery, and Stellar transaction reconciliation remain pending configuration and explicit user authorization.
