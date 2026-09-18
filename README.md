# Vesrune

**Earn your next move.** A yield-funded work account: realized earnings pay for tasks the owner approves. Deposited capital is not task money.

This delivery is a complete interactive **frontend preview and backend implementation handoff**, not a connected testnet DApp. No Pollar API, real agent service, wallet, or blockchain transaction is called. All balances, providers, earnings, deliveries, and receipts are clearly marked examples.

## Run locally

Requires Node 24 and npm 11.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. The development server binds only to the local machine. No credentials are required. Dependency lifecycle scripts are disabled in `.npmrc`.

To initialize the optional Pollar React SDK, copy `.env.local.example` to `.env.local` and set `VITE_POLLAR_API_KEY` to the `pub_testnet_` key from the Pollar dashboard. Restart Vite after changing environment variables. This only initializes the client; it does not make the local preview balances or actions live. The server key, if later required by Luna, belongs only in `server/.env` as `POLLAR_SERVER_API_KEY`.

```sh
npm run typecheck
npm test
npm run build
npm audit
```

## Product surfaces

- **Overview:** separate capital, pool gain, realized available balance, reservations, daily allowance, attention queue.
- **Earn:** deposit, capital withdrawal, earnings harvest, review dialogs, risk and unavailable states.
- **Work:** request creation, example service templates, search/filter, budget reservation, delivery review, acceptance/payment, rejection/cancellation.
- **Activity:** inspectable receipts, filtering, search, JSON export with explicit local provenance.
- **Rules:** per-task/daily caps, provider allowlist, immediate pause, manual payment acceptance.
- **Settings:** workspace preferences, account disconnect, integration readiness, local failure and pool-unavailable controls, empty/example workspace.

Preview data is saved under `vesrune.preview.v1` in localStorage. No authentication tokens are stored. Use only fictional briefs. Multiple tabs are not a transactional financial system; the backend must be authoritative.

## A two-minute preview

1. Overview → **Harvest 24.80** → confirm the local harvest. Capital remains 2,500 USDC.
2. Open **A clearer picture of the market** → approve and reserve 3.50 USDC.
3. Generate an example delivery, inspect it, then **Accept & pay in preview**.
4. Activity → inspect the payment receipt. It intentionally has no transaction hash.
5. Rules → pause spending. A new task cannot be approved or paid until resumed.
6. Settings → Preview lab → arm a failure. The next action fails without changing balances.

All numbers above describe the original seed. Actions persist, so your preview may differ.

## Code map

| Location | Responsibility |
| --- | --- |
| `src/App.tsx` | Six product screens, forms, review dialogs, navigation |
| `src/styles.css` | Midnight-plum design tokens, responsive layouts, motion/focus states |
| `src/domain.ts` | Pure preview ledger transitions, amount handling, policy checks |
| `src/gateway.ts` | Asynchronous local preview adapter and persistence |
| `src/liveApi.ts` | Read-only backend health/readiness probe; no mutation or wallet data |
| `src/main.tsx` | Optional PollarProvider initialization from the publishable testnet key |
| `shared/contracts.ts` | Existing preview/UI adapter contract |
| `shared/api.ts` | Proposed live wire model with explicit pending/reconciliation states |
| `docs/LUNA_BACKEND_PLAN.md` | Ordered backend implementation and acceptance gates |
| `docs/LUNA_PROMPT.md` | Copy/paste starting brief for Luna |
| `docs/DESIGN.md` | Product and visual decisions |
| `docs/VERIFICATION.md` | Verification evidence and remaining boundaries |

## Important boundaries

- The simplified preview does **not** implement production cost-basis accounting, partial-loss withdrawals, wallet authentication, onchain enforcement, or agent execution.
- The current frontend wiring only probes `/healthz` and `/readyz`; it does not call authenticated business routes because the backend handoff has not exposed them yet.
- Capital exclusion is a spending policy, **not a principal guarantee**. Earn protocols can lose funds or delay withdrawals.
- No APY is advertised, and the curve is explicitly illustrative.
- Pollar Earn pool visibility in a dashboard is not execution proof. Testnet support must be proven by actual deposit/read-back/withdrawal on the selected asset and wallet type.
- Ordinary wallet transfers are not called x402. Autonomous signing is not assumed.
- On/off ramps, mainnet, guaranteed returns, autonomous discretionary spending, and real-money deployment are outside this handoff.

No production deployment or hackathon submission has been made. Full-testnet prize eligibility and presentation requirements still need organizer confirmation.
