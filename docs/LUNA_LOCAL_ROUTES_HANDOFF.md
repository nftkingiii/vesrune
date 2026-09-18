# Local Routes backend handoff

Implemented the durable sandbox/manual corridor extension under `server/**`; no `src/**` or `shared/**` files were changed.

## Surface

- `GET /api/local-routes/capabilities` — explicit sandbox/testnet corridor readiness, fixed illustrative rate (`1500` NGN/USDC), and reason codes.
- `POST /api/local-routes/quotes` — exact NGN two-decimal fee and USDC seven-decimal destination calculation; 10-minute expiry; `1500.00`–`1500000.00` NGN bounds.
- `POST /api/local-routes` — quote-bound creation, owner-bound loopback sandbox identity, required `Idempotency-Key`.
- `GET /api/local-routes` and `GET /api/local-routes/:id` — owner-scoped reads.
- `POST /api/local-routes/:id/evidence` — reference-only evidence, never balance credit.
- `POST /api/local-routes/:id/review` — operator-only approve/reject.
- `POST /api/local-routes/:id/settlement` — requires an independently verified testnet proof callback; default adapter rejects all proofs.
- `POST /api/local-routes/:id/simulate-payout` — Bolivia-purpose settled routes only; explicit illustrative receipt, never a provider call or transaction hash.
- `POST /api/local-routes/:id/cancel` — only before evidence.

The default running server keeps sandbox identity disabled unless `LOCAL_ROUTES_SANDBOX_IDENTITY=true` is explicitly set. This mode is for loopback rehearsal only and must not be enabled for deployment. The current server still has no Pollar auth/session verification or RPC settlement verifier configured, so live settlement remains unavailable.

## Persistence

`server/migrations/002_local_routes.sql` adds durable quote, route, event, and owner-scoped idempotency tables. Run `npm run migrate` after `npm ci`; migration execution was not attempted because no PostgreSQL instance was provided.

The current service/store seam is deterministic and fully testable. Before production use, replace the store calls with PostgreSQL transactions and row locks while preserving quote locking, version checks, unique transaction hashes, and owner scope.

## Security and evidence boundaries

- Client amount and wallet fields are not accepted when creating a route; the server uses the quote and verified owner binding.
- NGN/USDC arithmetic rejects exponent, negative, malformed, over-precision, and out-of-range values.
- Reused idempotency keys with a different quote/owner digest fail; duplicate settlement hashes fail.
- Evidence and operator approval cannot mint capital or realized earnings.
- Settlement verifies success, finality, testnet network, exact issuer/asset, bound destination, and amount through an injected verifier; absent verifier means fail closed.
- Bolivia is always mocked and clearly labeled; there are no bank collection calls, mainnet calls, transfer execution, or fabricated proofs.

## Astra wiring

Use `shared/localRoutes.ts` as the DTO. Start with capabilities, then quote, then route creation. Store the returned `version`; include it in every transition. Use a unique `Idempotency-Key` for route creation and display `provenance: 'sandbox'`, `network: 'testnet'`, and capability reason codes. Do not map route statuses into preview balances or mark a route settled from evidence/review. Settlement must remain visibly unavailable until the backend receives independently verified Stellar testnet read-back.

## Verification

Expected commands from `server/`:

```sh
npm ci
npm run test
npm run typecheck
npm run build
npm audit --omit=dev
```

The local route unit suite covers quote math/expiry, invalid input, idempotency, owner/operator boundaries, version checks, evidence non-credit, settlement replay/wrong proof, and Bolivia simulation gating. No live transfer or deployment was performed.
