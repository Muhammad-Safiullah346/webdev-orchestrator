# webdev — a multi-agent app builder you run from the terminal

`webdev` is a command-line tool that **builds and modifies web apps for you** using a team of specialized AI agents. You describe what you want in plain English — `webdev "build a markdown notes app with tags"` — and it plans the work, designs the UI, writes the frontend and backend, tests it, reviews it for quality and security, and hands you a working app on a clean git history.

It runs on the [Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk). Under the hood, 14 real AI subagents (a designer, a frontend engineer, a backend engineer, testers, reviewers, a quality gate) each work in their own isolated context, coordinated by a deterministic controller. You don't need to know any of that to use it — but if you're curious, the [How it works](#how-it-works) section explains everything.

> **New here? Jump to [Getting started](#getting-started)** — it's a 4-step path from install to your first build.

---

## Getting started

Four steps. Do them in order — step 2 (auth) is required before anything will run.

### 1. Install

`webdev` is a global command. Install it once; then use it in any project folder.

```bash
# From npm (recommended):
npm install -g webdev-orchestrator

# …or straight from GitHub (no npm account needed):
npm install -g github:Muhammad-Safiullah346/webdev-orchestrator
```

Requires **Node.js 18+**. Everything else the tool needs (the AI agents, the design suite, safety hooks) ships inside the package — nothing else to download.

> If your `npm` is locked down and blocks install scripts, run `npm rebuild esbuild` once after installing (the TypeScript runtime needs it). Most setups don't need this.

### 2. Connect a model provider (required)

`webdev` doesn't include an AI model — you point it at one you have access to, using environment variables. Pick the **one** line that matches your setup and run it in your terminal:

```bash
# A) Direct Anthropic API (you have an Anthropic API key):
export ANTHROPIC_API_KEY=sk-ant-...

# B) A proxy or gateway (Kiro, LiteLLM, Envoy, a company gateway, …):
export ANTHROPIC_API_KEY=<your-key>   ANTHROPIC_BASE_URL=<the-proxy-url>

# C) Amazon Bedrock (uses your AWS credentials):
export CLAUDE_CODE_USE_BEDROCK=1

# D) Google Vertex (uses your GCP credentials):
export CLAUDE_CODE_USE_VERTEX=1
```

To make it permanent, add the line to your shell profile (`~/.bashrc`, `~/.zshrc`). To confirm it worked, `webdev doctor` (next step) tells you which provider it detected.

### 3. Run setup

```bash
webdev setup
```

This does two things once: installs the bundled **design suite** — 4 skills (`ui-ux-pro-max`, `design-system`, `brand`, `ui-styling`) that give the agents design taste — into `~/.claude/skills`, and runs a **health check** of your environment. It finishes by reminding you how to set auth if you haven't.

In that health-check output, you want ✓ for **Node, Auth, git, and the design suite**. **Python is recommended, not required:** two design-suite scripts need it — `ui-ux-pro-max`'s `search.py` (the design-intelligence engine that produces curated style/palette/font recommendations) and `ui-styling`'s `shadcn_add.py` (installs shadcn/ui components). Without Python the build still runs and the anti-slop guardrails still apply, but agents fall back to their own design judgment instead of the suite's curated recommendations, and install shadcn components another way (`npx shadcn`) — you lose the "$10,000-site" curation, not the safety floor. git can be skipped later with `--no-git`. If anything isn't green, fix it and re-run `webdev doctor` to re-check — you don't need to run full `setup` again.

### 4. Build something

From inside the folder where you want the app (empty folder for a new app, or an existing project to extend):

```bash
webdev "build a markdown notes app with tags and full-text search"
```

That's it. See [What happens when you run it](#what-happens-when-you-run-it) so nothing surprises you.

---

## What happens when you run it

A build is **interactive and visible** — it's not a black box, and it may pause to ask you things:

1. **It may ask a couple of questions first.** If your request is ambiguous about something important (should it have user accounts? a database?), it asks up to a few quick questions. If your request is clear, it just proceeds.
2. **It may ask for secret keys once.** If the app needs a third-party service (Stripe, OpenAI, email…), it prompts you **once**, with hidden input, for those keys — or you can skip and it will mock that service in tests. (Your own model key from step 2 is separate and never re-asked.)
3. **It works through phases, printing progress** — scoping, designing, building each feature, testing, reviewing, and a final quality score. This can take a while for a full app.
4. **It makes the app deploy-ready** (new apps and feature additions). Once the quality gate passes, the devops agent looks at the finished app, picks a sensible target for each piece (frontend, backend, database), generates the platform config, **wires the frontend to the backend** (API URL, CORS, per-side env vars), and writes a step-by-step `DEPLOY.md` plus a deploy-on-push CD workflow. It never deploys for you and never asks for your cloud credentials — you run the final step (or add repo secrets for CD). This removes the usual "now how do I actually ship this?" headache.
5. **You get a working app on clean git branches.** Features are built on `feature/*` branches and merged to `develop`; when the quality gate passes, `develop` merges to `main` with a version tag. Use `--no-git` to skip all git handling.

**Where things end up:**
- Your **app code** — written directly into the project folder.
- **`DEPLOY.md`** — a step-by-step guide to deploying the app (which platforms, which secrets go where, in what order), plus platform config files and a CD workflow.
- **`.workflow/`** — the build's working memory: the plan (`scope.yaml`), the design system, the API contract, and every agent's report under `.workflow/reports/`. If a build stops early, this is where to look.
- **`.env`** — created with working local values so the app actually runs; always git-ignored, never committed.

If the build can't reach the quality bar, it stops and tells you to check `.workflow/reports/` rather than shipping something broken.

---

## Commands

| Command | What it does |
|---------|--------------|
| `webdev "<request>"` | **The main command.** Build or modify a project from a plain-English request. |
| `webdev setup` | One-time onboarding: install the design suite + run the health check. |
| `webdev doctor` | Check your environment is ready (Node, auth, git, Python, design suite). |
| `webdev install-skills` | Re-install just the design suite into `~/.claude/skills`. |
| `webdev models` | Show which AI model each role will use. |
| `webdev models --probe` | Test which model names your provider actually accepts. |
| `webdev --help` | Full flag reference. |

---

## Modes — what kind of work to do

`webdev` guesses the right mode from your request and whether the folder already has code. Override it with `-m` when you want to be explicit.

| Mode | Use it for | Example |
|------|-----------|---------|
| `greenfield` | Building a brand-new app from scratch | `webdev "build a recipe sharing site"` |
| `iteration` | Adding features to an existing app | `webdev "add CSV export" -m iteration` |
| `bugfix` | Diagnosing and fixing a specific defect | `webdev "login returns 500 after signup" -m bugfix` |
| `refactor` | Restructuring code without changing behavior | `webdev "split the giant server.js" -m refactor` |
| `ui-polish` | Improving how it looks | `webdev "make the landing page premium" -m ui-polish` |
| `migration` | Upgrading a dependency or framework | `webdev "upgrade to React 19" -m migration` |
| `audit` | Analysis only — reports, changes nothing | `webdev "review for security + perf" -m audit` |
| `explain` | Understanding existing code — how a feature/file/flow works (read-only, one agent, no build) | `webdev "how does the auth refresh work in auth.ts"` |

---

## Options

All optional — the defaults are sensible. Add them after your request:

```bash
webdev "build a blog" -m greenfield -t ./my-blog --fast
```

| Flag | Default | What it does |
|------|---------|--------------|
| `-m, --mode <mode>` | auto-detected | Force a mode (see the table above). |
| `-t, --target <dir>` | current folder | Which folder to build in (created if it doesn't exist). |
| `-p, --preset <name>` | `balanced` | Which model lineup to use: `balanced`, `diverse`, or `solo` (see [Model lanes](#model-lanes)). |
| `--threshold <1-100>` | `98` | The quality score the build must reach before it ships. |
| `-c, --concurrency <n>` | `3` | How many agents run at once. |
| `--fast` | off | Skip the browser-test + visual-review phases for a quicker (less thorough) pass. |
| `--no-git` | off | Don't create branches or commits — build everything in place. |
| `--no-deploy` | off | Skip the deploy phase — no deploy config, `DEPLOY.md`, or CD workflow. |
| `-y, --yes` | off | Non-interactive: don't prompt for anything (secrets get mocked). Good for scripts/CI. |
| `--model-<lane> <id>` | — | Advanced: set one role's model, e.g. `--model-build claude-opus-4-8`. |
| `--model <id>` | — | Advanced: one model for everything (only with `--preset solo`). |

---

## How it works

*(Everything below is background — you don't need it to use the tool.)*

### The pipeline

The tool doesn't let one AI improvise a whole app. A deterministic controller (plain code, not an AI) drives fixed phases and hands work to specialized agents:

```
discovery → [feature waves: designer → backend → frontend → docs/devops]  (parallel where possible)
          → provision (.env + database + seed data)
          → review wave (QA · security · code-review · performance)
          → runtime + browser tests → visual review (anti-slop gate)
          → quality gate (loops targeted fixes until score ≥ threshold)
          → deploy config (platform config + frontend↔backend wiring + DEPLOY.md + CD)
          → merge to main, tag a release
```

Each agent runs as its **own** AI session with a fresh context and only the tools it needs — so the reviewer isn't the same context that wrote the code, and quality doesn't degrade from one overloaded session juggling everything.

### The 14 agents

`discovery` `designer` `frontend` `backend` `docs` `devops` `qa` `security` `code-review` `performance` `e2e` `visual-qa` `bugfix` `conductor`.

Each has a scoped toolset (reviewers can't edit; the visual reviewer can only look) and a detailed system prompt in `src/prompts/`.

### Model lanes

Independent models catch each other's mistakes. The model that **writes** code is never the one that **reviews or tests** it — a reviewer running the same model as the author shares its blind spots; a different model catches them. Agents are grouped into lanes, each with its own model:

| Lane | Agents |
|------|--------|
| `scope` | discovery |
| `design` | designer |
| `build` | frontend, backend, devops, docs, performance, bugfix |
| `review` | security, code-review |
| `verify` | qa, e2e |
| `visual` | visual-qa |
| `gate` | conductor |

**Presets** (choose with `-p`):
- **`balanced`** (default) — builders use Opus 4.8; everything that designs/reviews/tests uses Sonnet 4.6. Guarantees author ≠ reviewer, using just two widely-available models.
- **`diverse`** — spreads across model families (build=Sonnet, review=GLM-5, verify=Haiku, …) for maximum blind-spot coverage. Run `webdev models --probe` first to confirm your provider serves those.
- **`solo`** — every lane uses one model (for a provider that only offers one).

`webdev models` shows the resolved lineup. To customize permanently, create `~/.claude/webdev-models.json`, e.g. `{ "build": "claude-opus-4-8", "review": "glm-5", "verify": "claude-haiku-4-5" }`. The tool warns you if a reviewing lane accidentally ends up on the same model as the builder.

> Model names depend on your provider. Defaults are Anthropic names (`claude-opus-4-8`, `claude-sonnet-4-6`, `claude-haiku-4-5`). Probe before relying on `diverse`.

### The anti-slop design layer

Generic AI output has a "fingerprint" — Inter font, a purple-to-blue gradient, three equal cards in a row, the same shadow on everything. `webdev` fights this deliberately: the designer runs a real design suite **first** (picking a distinctive style, palette, and font pairing), publishes design tokens + a component registry, and the frontend may only use those. A `design-lint` hook warns when slop patterns appear in code, and the `visual-qa` agent looks at rendered screenshots and **blocks the build** if it sees the fingerprint. Full rules live in `.claude/CLAUDE.md`.

### Environment provisioning — so the app actually runs

Before testing, the tool makes the app bootable by filling in `.env`, handling variables by who can legitimately produce them:
- **Auto-generated** — `JWT_SECRET`, `PORT`, `NODE_ENV`, etc. Filled with strong randoms / sensible defaults.
- **Infrastructure** — the database connection and a seeded test user. This is **database-agnostic**: the app declares a working local connection string in its own `.env.example` (Postgres, MySQL, MongoDB, Redis, SQLite — whatever it uses), and the harness honors that value verbatim, brings up any server-based datastore via the app's `docker-compose.yml`, runs migrations, and seeds a known login. Apps with no database of their own fall back to a zero-service SQLite file.
- **External secrets** — Stripe/OpenAI/SMTP keys. It asks you once (hidden input) and writes them straight to `.env`; skipped ones get mocked in tests. `.env` is always git-ignored.
- **Object storage** — apps that handle uploads (images, PDFs, video) use an S3-compatible bucket in production (Cloudflare R2 by default). For testing, the harness forces a local filesystem driver and creates a git-ignored local directory, so verification never touches — or bills — your real bucket (the same principle as never testing against a remote database).

### Deployment — it ships the app for you

After a build passes the quality gate (greenfield and iteration modes), a dedicated **deploy phase** runs. Because it sees the *finished* app, the devops agent can do the part that's normally a headache — connecting a separately-deployed frontend and backend. Its goal is to keep your deployment cost at **$0**: for every component it picks a platform with a genuine free tier and documents that tier's limits (and where you'd start paying) in `DEPLOY.md`. It:
- **Picks a target per component** from the actual stack — a free-tier static/edge host for the frontend (Cloudflare Pages, Vercel Hobby, Netlify…), a free-tier container/serverless host for a standalone backend (the Dockerfile runs on Cloudflare Workers/Fly/Render/any VM), a managed provider **matched to the database the app actually uses** (Postgres → Neon/Supabase, Mongo → Atlas, Redis → Upstash, and so on — no Postgres-by-reflex), and object storage on Cloudflare R2. It chooses; it doesn't ask.
- **Wires them together** — sets the frontend's API base URL to the backend's deployed URL, configures CORS, and lists exactly which env vars each side needs in each environment.
- **Writes `DEPLOY.md`** — an ordered, do-this-then-that walkthrough (accounts, commands/clicks, which secret goes where).
- **Sets up CD** — a deploy-on-push workflow that uses secrets *you* add to your repo settings.
- **Deploys it** — the devops agent also writes a machine-readable recipe (`.workflow/deploy-plan.yaml`), and the harness runs it: it shows you the plan, asks you for the needed cloud tokens (hidden input), then runs each platform's CLI in order and prints the live URLs.

**The credential boundary:** the AI agent only *plans* the deploy — it never sees a cloud credential. The harness itself (plain code, not a model) collects your tokens via masked prompt and injects them straight into each CLI, so no secret ever enters an agent's context or transcript. Pass `--no-deploy` to skip the phase entirely. If the run is non-interactive (`-y`), a required CLI isn't installed, or you decline to enter tokens, it falls back to generating the config + `DEPLOY.md` for you to run yourself — nothing is deployed without your credentials.

### Memory — it learns across builds

- **Per project:** `<project>/.workflow/` holds the plan, design system, API contract, and reports — the single source of truth agents coordinate through.
- **Across projects:** `~/.claude/webdev-memory/` keeps quality benchmarks and recurring failure patterns, fed back into future builds so the tool improves over time.

### Safety

Agents run on your machine and use real tools (git, npm, tests) — which is what building an app requires. Guardrails keep that safe: a hook blocks destructive shell commands and hardcoded secrets, `.env`/`.ssh` and similar are unreadable, edits default to a review-friendly permission mode, and all work happens on git branches so nothing is unrecoverable. Best used on your own projects.

---

## For contributors

To work on `webdev` itself:

```bash
git clone https://github.com/Muhammad-Safiullah346/webdev-orchestrator.git
cd webdev-orchestrator && npm install
npm run webdev -- "build a notes app"   # run from the clone, no global install
npm link                                # or expose `webdev` globally from your clone
```

Project layout:

```
src/
  cli.ts           # command parsing, mode detection, env wiring
  orchestrator.ts  # the controller — phase machine, retries, quality gate
  agents.ts        # the 14 agent definitions (tools, models, skills)
  modes.ts         # the 8 modes → phase plans
  models.ts        # model lanes (build ≠ review ≠ verify)
  memory.ts        # file-based memory (project + global)
  env.ts           # environment provisioning
  doctor.ts        # the `webdev doctor` health check
  verify.ts        # build/runtime/git helpers
  seed.ts          # seeds the target project's .claude with hooks
  prompts/*.md     # the 14 agent system prompts
.claude/           # settings, safety hooks, CLAUDE.md, the design suite
bin/webdev         # the launcher
```

Releases use `npm run release` (patch), `release:minor`, or `release:major` — it type-checks, bumps, publishes to npm, then pushes to GitHub (rolling back if publish fails).

---

MIT
