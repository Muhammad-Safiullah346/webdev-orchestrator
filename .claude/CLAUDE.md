# Project conventions for AI sessions

This file is read by every agent (the SDK loads it via `settingSources`). It encodes the rules that keep a multi-agent build coherent.

## The single source of truth lives in `.workflow/`
- `.workflow/state.yaml` — build state (owned by the orchestrator; read-only to you).
- `.workflow/scope.yaml` — the features being built.
- `.workflow/design-system/MASTER.md` — the chosen style, palette, fonts, effects, and **anti-patterns**. The design law.
- `.workflow/semantic-registry.yaml` — the ONLY class/token names the UI may use.
- `.workflow/api-contracts.yaml` — the ONLY endpoints (method + path + shape) the UI may call.
- `.workflow/reports/*.md` — agent outputs the orchestrator collects.

Never invent a class name, token, or API path. If it isn't published, it's a gap — report it, don't guess.

## Design law (anti-slop — enforced by the visual-QA gate)
The "AI slop fingerprint" is banned. Each of these is a defect:
- Inter / Roboto / Arial / system-ui as the brand face (and don't reflex to Space Grotesk).
- Purple→indigo/blue hero gradient. Commit to a dominant color + 1–2 sharp accents.
- Flat type scale — use 3×+ size jumps and real weight contrast (400 → 700/800).
- Default three-equal-cards-in-a-row layout — build a real focal hierarchy.
- One uniform border-radius on everything — decide radius per role.
- The `0 1px 3px rgba(0,0,0,0.1)` shadow everywhere — use a deliberate elevation scale.
- Scattered micro-animations — one choreographed load moment; respect `prefers-reduced-motion`.
- Always: 4.5:1 text contrast, visible focus rings, real labels, keyboard paths, 44px touch targets.

Use the design suite (`~/.claude/skills/ui-ux-pro-max` → `brand` → `design-system` → `ui-styling`) — design-system FIRST, then implement against its tokens.

## Engineering rules
- Match the conventions already in the repo (naming, structure, libraries). New code reads like the surrounding code.
- Validate input at boundaries; parameterized queries only; never leak secrets or stack traces.
- Reference secrets by env-var name; never hardcode or commit values.
- Tests must actually run. "Compiles" ≠ "works".
- Render real data — never ship "Unknown"/placeholder/Lorem ipsum in the UI.
- Commit with `type(agent): description` (feat/fix/docs/test/refactor/perf/ci).

## Git flow
- `feature/*` → merge to `develop`. `bugfix/*` for any failure. `main` only receives tagged releases.
- The orchestrator manages branches; stay on the branch you're given.
