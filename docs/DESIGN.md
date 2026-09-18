# Vesrune design direction

## Product read

The owner wants useful work without accidentally spending deposited capital. The first decision is **what the account can safely allocate**, not which pool has the largest advertised APY. The visual hierarchy starts with available realized earnings, then separates capital and unharvested gains, then surfaces work needing attention.

Vesrune is a coined one-word name, chosen after a bounded exact-name web search on 2026-09-16 returned no obvious software/finance brand match. This is not domain availability, trademark clearance, or proof of global uniqueness. It has no claimed foreign-language translation.

## Visual system

- Midnight-plum background `#131017`; warm dark panels `#1c1822`; lavender actions `#ceb4f5`.
- Mint denotes completed/available example states; amber denotes attention/paused state. Text always states the meaning.
- Manrope for identity, headings, and prominent values; DM Sans for controls and reading. Fonts are bundled locally.
- An authored orbital account mark represents earnings moving into approved work. CSS/SVG only; no stock or AI-generated imagery needed.
- Accessible top-level navigation: Overview / Earn / Work / Activity / Rules / Settings. Hash links support browser back/forward.
- Larger account hero, compact secondary allowance panel, scannable task rows; avoid equal-sized decoration-only card grids.
- No diagonal arrow icons, category eyebrow above the page heading, fake testimonials, live APY, or fabricated transaction hashes.
- Intentional short control transitions; reduced-motion override. No autoplay, parallax, or looping decorative animation.

## Interaction and accessibility

Native dialogs provide inert background, focus containment, Escape, and focus return. Inputs have associated labels, semantic types/constraints, inline validation, disabled mutation controls, and a mutation lock. Status is text plus icon/color. Errors are announced with `role=alert`, confirmations with `role=status`.

Financial actions use review forms. Task payment requires opening the delivery and explicitly accepting it. No hover-only features. Small-screen task rows stack status beneath the title; navigation has intentional contained horizontal scroll at the narrowest size.

## Integration ownership

Astra owns the frontend and later integration. Luna owns backend modules and tests. The current preview is deliberately honest rather than a facade that calls a partial API and silently falls back to example money. Real integration must replace the preview label and amount provenance only after the full path is verified.

Reference inspected: [Linear's product features](https://linear.app/features), for focused workflow grouping and restrained information density. The layout, identity, palette, and account mechanism are independently authored.
