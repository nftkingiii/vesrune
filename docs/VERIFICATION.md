# Frontend verification

Scope: frontend preview and Luna backend handoff. Local checks, not live testnet proof.

## Automated checks

- `npm run build`: passed (TypeScript and production Vite build).
- `npm test`: **59 tests passed**, across pure ledger transitions, the preview gateway, and the read-only API probe.
- `npm audit`: zero reported vulnerabilities.
- `npm audit signatures`: 57 packages with verified registry signatures; 31 with verified attestations.
- Lifecycle scripts are disabled for subsequent installs via `.npmrc`. Initial installation preceded this policy; clean locked install remains a release check.

## Browser checks, September 16–17, 2026

- Desktop overview inspected visually: primary available balance, distinct capital/unharvested/paid values, work queue, custom orbital mark.
- Mobile overview, task form, and rules inspected at 390px. Corrected a nested mobile-navigation scrollbar.
- All six pages checked at 320px, 768px, and 1280px: no document-level horizontal overflow. Narrow navigation is intentionally horizontally scrollable.
- Harvested the example 24.80 USDC: capital stayed 2,500.00; available balance rose from 16.64 to 41.44.
- Approved the example Fieldnote task, reserved 3.50, generated the labeled example delivery, accepted and paid. Available balance became 37.94; 2.00 remained reserved for the other task; principal unchanged.
- Created a 100 USDC test request: approval blocked by the 10 USDC task cap.
- Armed a provider failure, attempted a 10 USDC deposit: visible error; capital stayed 2,500.00 and idle capital 125.00.
- Paused and resumed spending; UI reflects the policy.
- Filtered Activity to payments; opened a payment receipt with explicit local provenance and no transaction hash.
- Escape closes native dialogs.
- Final built frontend opened from `http://127.0.0.1:4173/` in a fresh browser tab: rendered successfully with no captured console errors or warnings. This is a local production-build preview, not a deployment.
- Read-only live API probe added and tested: with no `VITE_API_BASE_URL`, UI reports `API_NOT_CONFIGURED` and makes zero network calls; configured probe handles reachable/not-ready and network-error states without changing preview balances.
- Optional Pollar React SDK initialization added with `@pollar/react@0.11.3`; when `VITE_POLLAR_API_KEY` is present, `PollarProvider` is configured for Stellar testnet. No real key was stored or exercised in this verification run.
- With the local publishable key configured, the browser now exposes Pollar's real `WalletButton` and `Open Pollar Earn` entry point; both require user authentication before use.
- Luna backend: `npm run typecheck`, `npm run build`, and `npm audit` passed; `npm test` passed with **18 tests**. Local `server/.env` loading and credentialed CORS for the configured frontend origin are covered.
- An intermediate HMR edit briefly removed an icon import and produced a runtime error. Import restored; subsequent build and page checks passed. This is not a live integration failure.

## Boundaries and remaining checks

- No real wallet connection, signature, Pollar API call, real agent request, or onchain transaction occurred.
- The Pollar SDK provider is initialized only; wallet login, account reads, yield actions, agent payments, and transaction reconciliation are not wired yet.
- Luna loads local configuration from `server/.env` without overriding process variables; live capability readiness remains fail-closed until Pollar verification, pool, asset, and wallet execution are independently configured and proven.
- Only `/healthz` and `/readyz` are wired read-only. Authenticated workspace/task/operation routes are not yet available from Luna's current backend foundation, so no business mutation is wired.
- No public deployment or production security audit. Local state is mutable example data, never trusted financial authority.
- Loss/partial-withdrawal accounting, server authorization, durable jobs, pending transaction recovery, and cost-basis proof are Luna's implementation gates.
- Formal automated accessibility audit, all assistive-technology combinations, real phone/device wallet checks, and exported-file download verification remain future checks. Semantic labels, focus styling, native dialogs, and reduced-motion CSS are present.
- Testnet Earn support and full-testnet prize eligibility remain unproven; dashboard visibility and local success do not establish either.

Review mode: self-review with automated tests and browser checks; no independent security review claimed.
