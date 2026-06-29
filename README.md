# webdev — multi-agent web-development orchestrator

A Claude Agent SDK harness that builds web apps with a **team of real, isolated subagents** driven by a **deterministic PM** — not one model role-playing a whole team. It replaces the [turkey-build](https://github.com/rangerchaz/turkey-build) / `auto-app-builder` skill, swaps `aimem` for a **file-based memory** system, and wires an **anti-slop design layer** through the claudekit design suite so the output looks like a $10,000 site, not generic AI slop.

## Why this exists

[`turkey-build`](https://github.com/rangerchaz/turkey-build)'s "agents" are markdown files the single main model reads and *role-plays* sequentially — no context isolation, no real parallelism, quality degrades, slop ships. This harness uses the SDK's `agents` (real `AgentDefinition`s): each agent runs as its **own `query()`** with a fresh context, scoped tools, and the right model, while the orchestrator — **plain TypeScript** — owns the control flow (phase order, parallel waves, retries, quality gate). The model never decides the workflow.

```
discovery → [feature waves: designer→backend→frontend→docs/devops] (parallel, dependency-ordered)
          → provision (.env + db + migrations + seed) → regression check → review wave (parallel)
          → runtime verify → e2e + screenshots → visual-QA (anti-slop gate)
          → conductor quality gate (loops targeted bugfixes until ≥ threshold)
          → merge develop → main, tag release
```

## Install

`webdev` is a global CLI — **install it once, run it in any project. No cloning required.**

```bash
# Option A — from npm (once published):
npm install -g webdev-orchestrator

# Option B — straight from GitHub (works the moment the repo is pushed):
npm install -g github:Muhammad-Safiullah346/webdev-orchestrator
```

Either way you then run, from inside *any* project directory:

```bash
webdev setup    # copies the bundled design suite into ~/.claude/skills, runs a preflight
webdev doctor   # verifies Node, auth, git, Python, design suite
webdev "build a markdown note app with tags and search"
```

The install ships everything it needs (the 14 agents, the design suite, the hooks) inside the package — there is no build step and nothing else to fetch.

> If your `npm` is locked down and blocks dependency install scripts, run `npm rebuild esbuild` once after install (the `tsx` runtime depends on it). Standard npm setups handle this automatically.

### Auth — bring your own model provider

The harness bundles **no** provider. It sends model requests to whatever the Agent SDK env vars point at, so it works the same against the Anthropic API, a proxy/gateway (Kiro, LiteLLM, Envoy…), or Bedrock/Vertex. Set **one** of:

```bash
export ANTHROPIC_API_KEY=sk-ant-...                            # direct Anthropic API
export ANTHROPIC_API_KEY=<key>  ANTHROPIC_BASE_URL=<proxy-url> # proxy / gateway
export CLAUDE_CODE_USE_BEDROCK=1                               # Amazon Bedrock (AWS creds)
export CLAUDE_CODE_USE_VERTEX=1                                # Google Vertex (GCP creds)
```

`webdev doctor` reports which path it detected. Nothing in the harness is hardwired to any provider — the only coupling is these env vars.

### Developing on the harness itself

```bash
git clone https://github.com/Muhammad-Safiullah346/webdev-orchestrator.git
cd webdev-orchestrator && npm install
npm run webdev -- "build a notes app"   # run without a global install
npm link                                # or expose `webdev` globally from the clone
```


## Usage

The core command is `webdev "<what to build>"`. Run it from inside any project directory:

```bash
webdev "build a markdown note app with tags and search"        # greenfield (auto-detected)
webdev "add dark mode and CSV export" -m iteration -t ./notes  # iteration
webdev "login returns 500 after the migration" -m bugfix       # bugfix
webdev "make the landing page premium, not generic" -m ui-polish
webdev "review this codebase for security + perf" -m audit
```

### Commands

| Command | What it does |
|---------|--------------|
| `webdev "<request>"` | Build/modify a project (the main command; mode auto-detected) |
| `webdev setup` | One-time onboarding: install the design suite into `~/.claude/skills`, then run the preflight |
| `webdev doctor` | Check the environment is ready (Node, auth, git, Python, design suite) |
| `webdev install-skills` | (Re)install just the bundled design suite into `~/.claude/skills` |
| `webdev models` | Print the resolved lane→model map |
| `webdev models --probe` | Test which model IDs your provider actually accepts |
| `webdev --help` | Full usage and flag reference |

### Modes (same engine, different phase plan)

| Mode | What it does |
|------|--------------|
| `greenfield` | New build from scratch → full pipeline → tagged release |
| `iteration` | Add features to an existing app, guarding regressions → point release |
| `bugfix` | Reproduce → trace → isolate root cause → minimal fix → verify |
| `refactor` | Restructure code, prove behavior unchanged |
| `ui-polish` | Re-run the design suite, fix CSS/layout, pass visual-QA |
| `migration` | Upgrade deps/framework incrementally with tests at each step |
| `audit` | Analysis only — reports, no code changes |

Mode is auto-detected from your request and whether the target already has code; override with `-m`.

### Options

| Flag | Default | Description |
|------|---------|-------------|
| `-m, --mode <mode>` | auto-detected | Force a mode (see table above) |
| `-t, --target <dir>` | current dir | Project directory to build in (created if missing) |
| `-p, --preset <name>` | `balanced` | Model preset: `balanced`, `diverse`, or `solo` |
| `--model-<lane> <id>` | — | Override one lane's model (e.g. `--model-build`, `--model-review`) |
| `--model <id>` | — | Single model for all lanes (only valid with `--preset solo`) |
| `--threshold <1-100>` | `98` | Quality-gate score the conductor must reach to ship |
| `-c, --concurrency <n>` | `3` | Max agents running in parallel per wave |
| `--fast` | off | Skip the E2E + visual-QA phases for a quicker pass |
| `--no-git` | off | Single-branch mode; skip git branch/merge orchestration |
| `-y, --yes` | off | Non-interactive: auto-approve tool use, mock external secrets |

## Model lanes — independent models, independent blind spots

The model that **builds** code is never the one that **reviews, tests, or judges** it. A reviewer running the same model as the author shares its blind spots and rationalizes the same mistakes; an independent model catches them. Agents are grouped into lanes, each with its own model:

| Lane | Agents |
|------|--------|
| `scope` | discovery |
| `design` | designer |
| `build` | frontend, backend, devops, docs, performance, bugfix |
| `review` | security, code-review |
| `verify` | qa, e2e |
| `visual` | visual-qa |
| `gate` | conductor |

**Presets** (`-p`):
- **balanced** (default) — `build`=Opus 4.8, everything that judges/designs/verifies=Sonnet 4.6. Author (Opus) ≠ reviewer/tester (Sonnet) everywhere, using only the two IDs most likely on your proxy.
- **diverse** — cross-family spread (design=Opus, build=Sonnet, review=GLM-5, verify=Haiku, visual=Opus) for maximum blind-spot coverage. Run `webdev models --probe` first to confirm the IDs.
- **solo** — all lanes inherit one model (for a single-model proxy).

`webdev models` prints the resolved map; `webdev models --probe` tests which model IDs your proxy actually accepts. Persist a custom map in `~/.claude/webdev-models.json`, e.g. `{ "build": "claude-opus-4-8", "review": "glm-5", "verify": "claude-haiku-4-5" }`. The resolver **warns** if any judging lane collapses onto the build model.

> Model IDs depend on what your proxy serves. Defaults use Anthropic-dialect IDs (`claude-opus-4-8`, `claude-sonnet-4-6`, `claude-haiku-4-5`); Kiro Enterprise also exposes cross-family models (GLM-5, DeepSeek, Qwen). Probe before relying on `diverse`.

## The 14 agents

`discovery` `designer` `frontend` `backend` `docs` `devops` `qa` `security` `code-review` `performance` `e2e` `visual-qa` `bugfix` `conductor`. Each has a scoped toolset (read-only reviewers can't edit; visual-QA only reads) and a system prompt in `src/prompts/`. Design-facing agents preload the design suite skills.

## Environment provisioning (so the app actually runs)

Before runtime/E2E verification, a deterministic **provision** phase makes the app bootable, handling env vars by who can legitimately produce the value:

- **Generated** (`JWT_SECRET`, `SESSION_SECRET`, `PORT`, `BASE_URL`, `NODE_ENV`) — code fills these with strong randoms / localhost defaults. No human needed.
- **Infra + fixtures** (`DATABASE_URL`, `TEST_USER_EMAIL/PASSWORD`) — the harness infers a local DB URL from the stack (SQLite file, or `docker compose up -d` for Postgres/MySQL), runs migrations, and runs the backend's seed script that creates a **known test user** the E2E agent logs in with.
- **External secrets** (`STRIPE_SECRET_KEY`, `OPENAI_API_KEY`, `SMTP_PASSWORD`, OAuth) — only you can supply a valid one. Discovery **declares them by name** in `scope.yaml` (never values); the harness then prompts you **once, up front, with masked input** and writes them straight to `.env`. The raw value never enters any agent's context or transcript. On a non-interactive run (`-y`) or for any secret you skip, the E2E agent **mocks** that service at the network layer, so the build still completes unattended.

`.env` is always added to `.gitignore` and never committed. Existing `.env` keys are never overwritten (idempotent, resume-safe).

## Memory (file-based — replaces aimem)

- **Project-local** `<target>/.workflow/` — `state.yaml`, `scope.yaml`, `semantic-registry.yaml`, `api-contracts.yaml`, `design-system/`, `reports/`. The coordination + handoff layer; the registry and contracts are the **single source of truth** the frontend builds against.
- **Global vault** `~/.claude/webdev-memory/` — cross-project benchmarks (`p50/p75/p90`) and failure patterns, fed into the discovery and conductor prompts so each build learns from the last.

## The anti-slop design layer

The designer **must** run the design suite design-system-first (`ui-ux-pro-max --design-system` → `brand` → `design-system` tokens → `ui-styling`), publish tokens + a semantic registry, and the frontend may only use those names. The `design-lint` hook warns on the slop fingerprint as code is written; the `visual-qa` agent reads the rendered screenshots and **blocks** the build on banned patterns (Inter/Roboto default, purple-indigo gradient, three-card grid, uniform radius, 0.1-opacity shadows). See `.claude/CLAUDE.md` for the full design law.

## `.claude/` config

- `settings.json` — permissions + hook wiring.
- `hooks/secret-guard.mjs` — PreToolUse: blocks destructive shell commands + hardcoded secrets.
- `hooks/design-lint.mjs` — PostToolUse: warns on the slop fingerprint in written CSS/JSX.
- `CLAUDE.md` — rules every agent inherits.
- `agents/*.md` — filesystem mirror of the 14 agents (regenerate with `npx tsx src/gen-agents.ts`).
- `skills/` — the bundled claudekit design suite (installed to `~/.claude/skills` via `install-skills`).

During a build the orchestrator seeds the target project's `.claude/` with the hooks so the gates fire there too.

## Deployment

The harness is a one-shot CLI: each `webdev "..."` invocation runs a build to completion and exits (the *ephemeral* pattern from the Agent SDK hosting guide). There is no server to run — it is not a multi-tenant service.

`npm link` it (or `npm i -g`) and run `webdev` in any project directory. It works immediately with whatever model auth you've exported. Agents operate directly on your project's files and run `git`/`npm`/test commands on the host — which is exactly what a build needs. The built-in guardrails (secret-guard hook, `.env`/`.ssh` deny rules, `acceptEdits` permission mode, per-branch git flow) keep that safe for building your own projects.

## Layout

```
src/
  cli.ts           # arg parse, mode detect, env wiring, skills installer
  orchestrator.ts  # the PM — deterministic phase machine + retries/escalation
  agents.ts        # 14 AgentDefinitions (scoped tools/models/skills)
  modes.ts         # 7 modes → phase plans
  models.ts        # model lanes — independent model per role (build≠review≠verify)
  memory.ts        # file-based memory (project + global vault)
  env.ts           # env provisioning (generated/infra/external secrets)
  doctor.ts        # `webdev doctor` environment preflight
  verify.ts        # build/runtime/git helpers
  seed.ts          # seeds target .claude with hooks
  types.ts         # shared types
  prompts/*.md     # the 14 agent system prompts (anti-slop baked in)
  gen-agents.ts    # regenerates .claude/agents/*.md from prompts
.claude/           # settings, hooks, CLAUDE.md, agents mirror, design suite
bin/webdev         # launcher (resolves tsx, runs src/cli.ts)
```

MIT.
