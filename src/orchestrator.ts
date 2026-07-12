// The orchestrator — the PM, implemented as deterministic code.
//
// turkey-build failed because it handed orchestration to the model. Here the
// control flow (phase order, parallel waves, retries, quality gate) lives in
// code. Each agent runs as its OWN isolated query() — a fresh context, scoped
// tools, the right model — and the orchestrator decides what runs when.

import { query } from "@anthropic-ai/claude-agent-sdk";
import YAML from "yaml";
import { join } from "node:path";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import type { AgentDefinition } from "@anthropic-ai/claude-agent-sdk";
import type { AgentName, ConductorScore, Feature, RunConfig, Scope } from "./types.ts";
import { buildAgents } from "./agents.ts";
import { Memory } from "./memory.ts";
import { planFor, type PhasePlan } from "./modes.ts";
import { laneSummary } from "./models.ts";
import { seedTargetClaude } from "./seed.ts";
import {
  exampleEnv, exampleKeys, fallbackSqliteUrl, generateValue, isDbUrlName,
  isGeneratableSecret, isInteractive, looksExternal, mergeEnv, parseEnv,
  promptForSecrets, type EnvVar,
} from "./env.ts";
import {
  bootstrapGit, buildGate, commitAll, createBranch, mergeToDevelop,
  releaseToMain, sh,
} from "./verify.ts";

// Retry ceilings before escalating to the user.
const RETRY = { feature: 3, runtime: 5, e2e: 5, conductor: 3, bugfix: 3 };

type Logger = (line: string) => void;

export class Orchestrator {
  private readonly cfg: RunConfig;
  private readonly mem: Memory;
  private readonly agents: Record<AgentName, AgentDefinition>;
  private readonly plan: PhasePlan;
  private readonly log: Logger;
  /** External secrets collected once after discovery (names→values). Never logged. */
  private collectedSecrets: Record<string, string> = {};

  constructor(cfg: RunConfig, log: Logger) {
    this.cfg = cfg;
    this.mem = new Memory(cfg.target);
    this.agents = buildAgents(cfg);
    this.plan = planFor(cfg.mode, cfg.fast);
    this.log = log;
  }

  // ── public entry ───────────────────────────────────────────────────────
  async run(): Promise<{ ok: boolean; score?: number; summary: string }> {
    this.log(`\n🛠  webdev — mode: ${this.cfg.mode}`);
    this.log(`   ${this.plan.summary}`);
    this.log(`🧠 models (preset: ${this.cfg.preset}):\n${laneSummary(this.cfg.laneModels)}\n`);

    this.mem.initState({
      project: deriveName(this.cfg.request, this.cfg.target),
      mode: this.cfg.mode,
    });

    // Seed the target's .claude so the secret-guard / design-lint hooks fire
    // during the build (subagents run with cwd = target).
    try { seedTargetClaude(this.cfg.target); } catch (e) {
      this.log(`   (could not seed target .claude: ${String((e as any)?.message ?? e)})`);
    }

    if (!this.cfg.noGit) {
      this.mem.setPhase("bootstrap");
      await bootstrapGit(this.cfg.target);
      this.log("🌱 git ready (main + develop)\n");
    }

    // Explain mode is read-only and needs no scope/git/pipeline — short-circuit
    // before discovery so a plain question never triggers a build.
    if (this.cfg.mode === "explain") return this.runExplainMode();

    // 1. Scope
    let scope = this.mem.readScope();
    if (this.plan.scope || !scope) {
      scope = await this.phaseScope();
    }
    if (!scope) {
      return { ok: false, summary: "Discovery produced no scope.yaml — cannot proceed." };
    }

    // Special-case the lightweight modes that don't build features.
    if (this.cfg.mode === "bugfix") return this.runBugfixMode(scope);
    if (this.cfg.mode === "audit") return this.runAuditMode(scope);

    // Collect external secrets ONCE, up front (your chosen policy). Code does
    // this, not an agent — raw values never enter an LLM context or transcript.
    await this.collectSecrets(scope);

    // 2. Feature build waves
    if (this.plan.featureBuild) {
      await this.phaseFeatureWaves(scope);
    }

    // 2b. Provision the runtime env (.env, db, migrations, seed) before anything
    // tries to boot the app for verification.
    await this.phaseProvision(scope);

    // 3. Regression check (iteration/refactor/migration)
    if (this.plan.regressionCheck) {
      await this.phaseRegression();
    }

    // 4. Review wave
    if (this.plan.reviewWave.length) {
      await this.phaseReviewWave(scope);
    }

    // 5. Runtime verification
    if (this.plan.runtime) {
      await this.phaseRuntime();
    }

    // 6. E2E + 7. Visual QA
    if (this.plan.e2e) await this.phaseE2E();
    if (this.plan.visualQa) await this.phaseVisualQa();

    // 8. Conductor gate (loops with targeted bugfixes)
    let score: ConductorScore | null = null;
    if (this.plan.conductor) {
      score = await this.phaseConductorLoop(scope);
    }

    const passed = !score || score.decision === "pass";

    // 9. Deploy config — only for a passing build. Runs on the FINISHED app so
    // devops can wire frontend↔backend and produce coherent deploy artifacts.
    if (passed && this.plan.deploy && !this.plan.analysisOnly) {
      await this.phaseDeploy(scope);
    }

    // 10. Release
    if (passed && !this.cfg.noGit && !this.plan.analysisOnly) {
      const tag = nextTag(scope);
      await releaseToMain(this.cfg.target, tag);
      this.log(`\n🚢 merged develop → main, tagged ${tag}`);
    }

    // Record outcome to the cross-project vault.
    if (score) {
      Memory.recordProjectOutcome({
        project: deriveName(this.cfg.request, this.cfg.target),
        mode: this.cfg.mode,
        final_score: score.score,
        iterations: this.mem.readState()?.iterations ?? 1,
        issues: score.blocking_issues.map((b) => b.dimension),
      });
    }

    this.mem.setPhase(passed ? "done" : "incomplete");
    return {
      ok: passed,
      score: score?.score,
      summary: passed
        ? `Build complete${score ? ` at ${score.score}/100` : ""}.`
        : `Stopped below the quality gate${score ? ` (${score.score}/100)` : ""}. See .workflow/reports/.`,
    };
  }

  // ── phases ───────────────────────────────────────────────────────────────

  private async phaseScope(): Promise<Scope | null> {
    this.mem.setPhase("scope");
    this.log("📋 Discovery: scoping the build…");
    const briefing = Memory.vaultBriefing();
    await this.runAgent("discovery", [
      `Mode: ${this.cfg.mode}.`,
      `Build request: ${this.cfg.request}`,
      ``,
      `Working directory: ${this.cfg.target} (read any existing code here first).`,
      `Write the scope to .workflow/scope.yaml in the exact required shape.`,
      ``,
      `Cross-project context:\n${briefing}`,
    ].join("\n"));
    const scope = this.mem.readScope();
    if (scope) this.log(`   → ${scope.features.length} features scoped\n`);
    return scope;
  }

  private async phaseFeatureWaves(scope: Scope): Promise<void> {
    this.mem.setPhase("feature-build");
    const waves = topoWaves(scope.features);
    this.log(`🏗  Building ${scope.features.length} features in ${waves.length} wave(s)…`);

    for (let i = 0; i < waves.length; i++) {
      const wave = waves[i];
      this.log(`\n   Wave ${i + 1}: ${wave.map((f) => f.name).join(", ")}`);
      // Features in a wave are independent → build in parallel (bounded).
      await mapLimit(wave, this.cfg.concurrency, async (feature) => {
        await this.buildFeature(feature);
      });
    }
    this.log("");
  }

  private async buildFeature(feature: Feature): Promise<void> {
    if (!this.cfg.noGit) await createBranch(this.cfg.target, feature.branch);

    // Agents on a feature collaborate sequentially on the same branch, in a
    // sensible order: designer → backend → frontend → docs/devops.
    const order: AgentName[] = orderedAgents(feature.agents);
    for (const agent of order) {
      this.log(`     • ${agent} → ${feature.name}`);
      await this.runAgent(agent, this.featureTask(agent, feature));
      this.mem.refreshReadiness();
    }

    if (!this.cfg.noGit) {
      await commitAll(this.cfg.target, `feat(${feature.name}): complete feature`);
      // Post-merge smoke test: build must still pass.
      await mergeToDevelop(this.cfg.target, feature.branch);
      const smoke = await buildGate(this.cfg.target);
      if (!smoke.ok) {
        this.log(`     ⚠ smoke test failed after merging ${feature.name} — dispatching bugfix`);
        await this.dispatchBugfix(`Build broke after merging ${feature.name}.\n\n${smoke.detail}`, "build-after-merge");
      }
      this.mem.markFeatureMerged(feature.name);
    }
  }

  /** Collect external secrets once, up front (code-driven, masked, never logged). */
  private async collectSecrets(scope: Scope): Promise<void> {
    const declared = scope.external_secrets ?? [];
    if (!declared.length) return;
    const names = declared.map((s) => s.name).join(", ");
    if (!isInteractive(this.cfg.yes)) {
      this.log(`🔑 ${declared.length} external secret(s) declared (${names}).`);
      this.log(`   Non-interactive run — these will be MOCKED in tests. Provide them in .env to use the real services.\n`);
      return;
    }
    const vars: EnvVar[] = declared.map((s) => ({ name: s.name, class: "external", purpose: s.purpose }));
    this.collectedSecrets = await promptForSecrets(vars);
    const got = Object.keys(this.collectedSecrets).length;
    this.log(`🔑 Collected ${got}/${declared.length} secret(s); the rest will be mocked in tests.\n`);
  }

  /** Provision the runtime env so the app can actually boot for verification. */
  private async phaseProvision(scope: Scope): Promise<void> {
    this.mem.setPhase("provision");
    this.log("🔌 Provisioning runtime env (.env, database, migrations, seed)…");
    const cwd = this.cfg.target;
    const project = scope.project.name || "app";

    // 1. Fill each declared var by CLASS — database-agnostic. We never guess a
    //    database type: the app's own .env.example carries a working local
    //    connection string as the sample value, and we honor it verbatim. This
    //    works for Postgres, MySQL, Mongo, Redis, or anything else the agent
    //    chose, without the harness enumerating database types.
    const sample = exampleEnv(cwd);          // key → declared sample value
    const keys = Object.keys(sample);
    const existing = parseEnv(join(cwd, ".env"));
    const generated: Record<string, string> = {};

    for (const key of keys) {
      if (existing[key] !== undefined) continue;              // never overwrite a user value
      if (isGeneratableSecret(key)) {
        generated[key] = generateValue(key);                  // fresh random — ignore placeholder
      } else if (looksExternal(key)) {
        if (this.collectedSecrets[key]) generated[key] = this.collectedSecrets[key]; // user-supplied only
      } else if (sample[key] && sample[key] !== "" && !/^(changeme|xxx+|your[-_]|<.*>|placeholder|todo)$/i.test(sample[key])) {
        generated[key] = sample[key];                         // honor the declared value (DB URLs, config)
      } else {
        generated[key] = generateValue(key);                  // no usable sample → sensible default
      }
    }
    // Secrets the user supplied that weren't in the example get added too.
    for (const [k, v] of Object.entries(this.collectedSecrets)) generated[k] = v;

    // If no example existed but a backend is in play, seed core vars + a
    // zero-service SQLite DB (safe default; the app can override in its own .env).
    if (!keys.length && scope.features.some((f) => f.agents.includes("backend"))) {
      Object.assign(generated, {
        DATABASE_URL: fallbackSqliteUrl(project),
        NODE_ENV: "development",
        PORT: "3000",
      });
    }

    const added = mergeEnv(cwd, generated);
    if (added.length) this.log(`   .env: set ${added.length} var(s) [${maskList(added)}]`);
    await this.ensureEnvGitignored(cwd);

    // 2. Stand up local backing services if the app ships a docker-compose —
    //    ANY database/service (Postgres, MySQL, Mongo, Redis, …). We don't
    //    inspect the image; the agent wrote compose for whatever it needs, we
    //    just bring it up. A file: SQLite URL needs nothing, so no compose = fine.
    const composeExists = existsSync(join(cwd, "docker-compose.yml")) || existsSync(join(cwd, "docker-compose.yaml"));
    const needsService = keys.some((k) => isDbUrlName(k) && !/^file:|sqlite/i.test(generated[k] ?? existing[k] ?? ""));
    if (composeExists && needsService) {
      const up = await sh("docker compose up -d 2>&1 || docker-compose up -d 2>&1", { cwd, timeoutMs: 120_000 });
      this.log(up.code === 0 ? "   backing services up ✓ (docker compose)" : "   ⚠ could not start services (continuing)");
      await sh("sleep 4", { cwd, timeoutMs: 8_000 }); // brief wait for readiness
    } else if (needsService && !composeExists) {
      this.log("   ⚠ app declares a server-based datastore but ships no docker-compose — it may need an external service");
    }

    // 3. Run migrations + seed, using whatever scripts the project defines.
    await this.runIfScript(cwd, ["db:migrate", "migrate", "prisma:migrate"], "migrations");
    await this.runIfScript(cwd, ["db:seed", "seed"], "seed data");
    this.log("");
  }

  private async ensureEnvGitignored(cwd: string): Promise<void> {
    await sh("grep -qxF '.env' .gitignore 2>/dev/null || echo '.env' >> .gitignore", { cwd, timeoutMs: 8_000 });
  }

  /** Run the first matching npm script if it exists. Best-effort. */
  private async runIfScript(cwd: string, candidates: string[], label: string): Promise<void> {
    const pkgPath = join(cwd, "package.json");
    if (!existsSync(pkgPath)) return;
    let scripts: Record<string, string> = {};
    try { scripts = JSON.parse(readFileSync(pkgPath, "utf8")).scripts ?? {}; } catch { return; }
    const found = candidates.find((c) => scripts[c]);
    if (!found) return;
    const res = await sh(`npm run ${found}`, { cwd, timeoutMs: 180_000 });
    this.log(res.code === 0 ? `   ${label} ✓ (npm run ${found})` : `   ⚠ ${label} failed (npm run ${found}) — continuing`);
  }

  private async phaseRegression(): Promise<void> {
    this.mem.setPhase("regression");
    this.log("🔁 Regression check (existing behavior must still work)…");
    const build = await buildGate(this.cfg.target);
    if (!build.ok) {
      await this.dispatchBugfix(`Regression: build fails on develop.\n\n${build.detail}`, "regression-build");
    } else {
      this.log("   build ✓\n");
    }
  }

  private async phaseReviewWave(scope: Scope): Promise<void> {
    this.mem.setPhase("review");
    const reviewers = this.plan.reviewWave;
    this.log(`🔎 Review wave (parallel): ${reviewers.join(", ")}…`);
    // Reviewers analyze develop independently → run in parallel.
    await mapLimit(reviewers, this.cfg.concurrency, async (agent) => {
      await this.runAgent(agent, [
        `Review the current state of the project on the develop branch.`,
        `Write your findings to .workflow/reports/${agent}.md as specified in your instructions.`,
        `Project: ${scope.project.name} (${scope.project.stack ?? "unknown stack"}).`,
      ].join("\n"));
    });

    // Turn blocking review findings into targeted bugfixes.
    for (const agent of reviewers) {
      const report = this.mem.readReport(agent);
      if (report && /\b(critical|high)\b/i.test(report) && /\bblocking|must fix|vulnerab/i.test(report)) {
        await this.dispatchBugfix(
          `The ${agent} review flagged blocking issues. Read .workflow/reports/${agent}.md and fix the critical/high items only.`,
          `${agent}-blocking`,
        );
      }
    }
    this.log("");
  }

  private async phaseRuntime(): Promise<void> {
    this.mem.setPhase("runtime");
    this.log("▶️  Runtime verification…");
    let attempt = 0;
    while (attempt < RETRY.runtime) {
      const build = await buildGate(this.cfg.target);
      if (build.ok) { this.log("   build ✓\n"); return; }
      attempt++;
      this.log(`   build failed (attempt ${attempt}/${RETRY.runtime}) — dispatching bugfix`);
      await this.dispatchBugfix(`Runtime/build verification failed.\n\n${build.detail}`, `runtime-${attempt}`);
    }
    await this.escalate("runtime", "Build still failing after max retries. See .workflow/reports/.");
  }

  private async phaseE2E(): Promise<void> {
    this.mem.setPhase("e2e");
    this.log("🌐 E2E browser tests + screenshot capture…");
    await this.runAgent("e2e", [
      `Set up Playwright if needed, run end-to-end tests of the user flows on the running app,`,
      `and capture screenshots into .workflow/reports/screenshots/ at desktop/tablet/mobile.`,
      `Write results to .workflow/reports/e2e.md.`,
    ].join("\n"));
    this.log("");
  }

  private async phaseDeploy(scope: Scope): Promise<void> {
    this.mem.setPhase("deploy");
    this.log("🚀 Deploy phase: generating deploy config + wiring + DEPLOY.md (no credentials, nothing deployed)…");
    await this.runAgent("devops", [
      `The app is BUILT and has passed the quality gate. Produce everything needed to DEPLOY it — config only, do not deploy anything and do not ask for cloud credentials.`,
      `Project: ${scope.project.name} (${scope.project.stack ?? "unknown stack"}).`,
      ``,
      `You are looking at the FINISHED app, so you can now wire the pieces together:`,
      `1. Decide the best-fit deploy target for each component (frontend, backend, database, integrations) from the actual stack — you choose the platforms.`,
      `2. Generate the platform deploy config for each component.`,
      `3. WIRE THEM: set the frontend's API base URL to the backend's deployed URL, configure CORS, and list the exact env vars each side needs in each environment.`,
      `4. Write DEPLOY.md: precise step-by-step instructions the user follows to deploy (accounts to create, buttons/commands, which secrets to set where).`,
      `5. Add a deploy-on-push CD workflow that uses secrets the USER adds to their repo settings (reference them by name; never embed a real value).`,
      ``,
      `Production database + third-party keys are the user's to supply — document them as required secrets/connection strings in DEPLOY.md; never invent or commit values.`,
      `Write a summary to .workflow/reports/deploy.md.`,
    ].join("\n"));
    this.log("");
  }

  private async phaseVisualQa(): Promise<void> {
    this.mem.setPhase("visual-qa");
    const dir = join(this.cfg.target, ".workflow", "reports", "screenshots");
    const shots = existsSync(dir) ? readdirSync(dir).filter((f) => /\.(png|jpe?g)$/i.test(f)).length : 0;
    if (!shots) { this.log("🎨 Visual QA: no screenshots found — skipping\n"); return; }
    this.log(`🎨 Visual QA: analyzing ${shots} screenshot(s) against the slop fingerprint…`);
    await this.runAgent("visual-qa", [
      `Analyze every screenshot in .workflow/reports/screenshots/ against the design system`,
      `(.workflow/design-system/MASTER.md) and the slop fingerprint.`,
      `Write .workflow/reports/visual-qa.md with severity-tagged findings.`,
    ].join("\n"));

    const report = this.mem.readReport("visual-qa");
    if (report && /\bcritical\b/i.test(report)) {
      this.log("   critical visual issues found — dispatching CSS bugfix");
      await this.dispatchBugfix(
        `Visual QA found critical issues. Read .workflow/reports/visual-qa.md and fix the critical CSS/layout/slop defects only.`,
        "visual-critical",
      );
    }
    this.log("");
  }

  private async phaseConductorLoop(scope: Scope): Promise<ConductorScore> {
    let attempt = 0;
    let score: ConductorScore = await this.runConductor(scope);
    while (score.decision === "iterate" && attempt < RETRY.conductor) {
      attempt++;
      const st = this.mem.readState();
      if (st) { st.iterations = attempt; this.mem.writeState(st); }
      this.log(`   conductor: ${score.score}/${this.cfg.threshold} — iterating (${attempt}/${RETRY.conductor})`);
      for (const fix of score.fixes_needed ?? []) {
        await this.dispatchBugfix(`${fix.issue}\n\n(Conductor-requested fix; agent hint: ${fix.agent})`, slug(fix.branch));
      }
      score = await this.runConductor(scope);
    }
    if (score.decision !== "pass") {
      await this.escalate("conductor", `Quality gate not met after ${attempt} iterations (best ${score.score}/${this.cfg.threshold}).`);
    } else {
      this.log(`   ✅ conductor: ${score.score}/100 — PASS\n`);
    }
    return score;
  }

  private async runConductor(scope: Scope): Promise<ConductorScore> {
    this.mem.setPhase("conductor");
    const briefing = Memory.vaultBriefing();
    const text = await this.runAgent("conductor", [
      `Score the build against the rubric. Threshold to ship: ${this.cfg.threshold}/100.`,
      `Project: ${scope.project.name}. Read all reports in .workflow/reports/.`,
      `Write .workflow/reports/conductor.md and end with the required YAML block.`,
      ``,
      `Cross-project benchmarks:\n${briefing}`,
    ].join("\n"));
    return parseConductor(text, this.cfg.threshold);
  }

  // ── lightweight modes ──────────────────────────────────────────────────

  private async runBugfixMode(scope: Scope): Promise<{ ok: boolean; summary: string }> {
    this.log("🐞 Bugfix mode…");
    const branch = "bugfix/reported-issue";
    if (!this.cfg.noGit) await createBranch(this.cfg.target, branch);

    // Provision the runtime env ONCE before the reproduce loop, so a RUNTIME
    // bug (500s, DB/auth failures) can actually be reproduced — the app must
    // boot for "reproduce → verify" to mean anything. Idempotent, so it's safe
    // outside the retry loop. (Provisioning is skipped for --no-git single-file
    // repos only if there's genuinely nothing to run; phaseProvision no-ops
    // cleanly when the project has no backend/db.)
    await this.phaseProvision(scope);

    let attempt = 0, ok = false;
    while (attempt < RETRY.bugfix && !ok) {
      attempt++;
      await this.runAgent("bugfix", [
        `Reported issue: ${this.cfg.request}`,
        `Follow the protocol: reproduce → trace → isolate → minimal fix → verify.`,
        `The runtime env is provisioned (.env, database, migrations, seeded test user), so you CAN boot the app to reproduce a runtime bug — start it, hit the failing path, and confirm the fix end-to-end, not just by reading code.`,
      ].join("\n"));
      const build = await buildGate(this.cfg.target);
      ok = build.ok;
      if (!ok) this.log(`   fix attempt ${attempt} left the build broken — retrying`);
    }
    if (this.plan.reviewWave.length) {
      await this.runAgent("qa", `Run the test suite and confirm the fix didn't break anything. Write .workflow/reports/qa.md.`);
    }
    if (ok && !this.cfg.noGit) {
      await commitAll(this.cfg.target, `fix: ${truncate(this.cfg.request, 60)}`);
      await mergeToDevelop(this.cfg.target, branch);
      await releaseToMain(this.cfg.target, nextTag(scope));
    }
    return { ok, summary: ok ? "Bugfix applied and verified." : "Could not verify the fix — see .workflow/reports/." };
  }

  private async runAuditMode(scope: Scope): Promise<{ ok: boolean; summary: string }> {
    this.log("🔬 Audit mode (analysis only — no code changes)…");
    await mapLimit(this.plan.reviewWave, this.cfg.concurrency, async (agent) => {
      await this.runAgent(agent, [
        `Audit the project. Do NOT change code — analysis only.`,
        `Write your findings to .workflow/reports/${agent}.md.`,
      ].join("\n"));
    });
    if (this.plan.visualQa) await this.phaseVisualQa();
    const score = await this.runConductor(scope);
    return { ok: true, summary: `Audit complete. Overall ${score.score}/100. Reports in .workflow/reports/.` };
  }

  private async runExplainMode(): Promise<{ ok: boolean; summary: string }> {
    this.mem.setPhase("explain");
    this.log("📖 Explain mode (read-only — understanding the code, changing nothing)…");
    const answer = await this.runAgent("explain", [
      `Question: ${this.cfg.request}`,
      ``,
      `Answer it by reading the actual code in ${this.cfg.target}. Ground every claim in file:line.`,
      `Change nothing. Write your explanation to .workflow/reports/explain.md and give the answer in your final message.`,
    ].join("\n"));
    return {
      ok: true,
      summary: answer?.trim()
        ? "Explanation ready (see above; also written to .workflow/reports/explain.md)."
        : "Explain agent produced no answer — see .workflow/reports/explain.md.",
    };
  }

  // ── agent runner — each agent is its own isolated query() ──────────────

  private async runAgent(name: AgentName, task: string): Promise<string> {
    const def = this.agents[name];
    this.mem.setAgentStatus(name, "in_progress");

    const options: Record<string, unknown> = {
      cwd: this.cfg.target,
      systemPrompt: def.prompt,
      allowedTools: def.tools,
      // Load ~/.claude (user) + project .claude so CLAUDE.md, the design suite
      // skills, and project agents are all available to the subagent.
      settingSources: ["user", "project"],
      // Non-interactive CLI the user explicitly invoked → don't prompt per tool.
      permissionMode: this.cfg.yes ? "bypassPermissions" : "acceptEdits",
      model: def.model ?? "inherit",
      maxTurns: 60,
      // Let an agent spawn the built-in helper agents if it needs to.
      agents: this.agents as unknown as Record<string, AgentDefinition>,
    };
    if (def.skills) (options as any).skills = def.skills;
    if ((def as any).effort) (options as any).effort = (def as any).effort;

    let finalText = "";
    try {
      for await (const message of query({ prompt: task, options: options as any })) {
        const m = message as any;
        if (m.type === "result") {
          if (m.subtype === "success" && typeof m.result === "string") finalText = m.result;
          else if (m.subtype && m.subtype !== "success") finalText ||= `[${m.subtype}]`;
        }
        // Surface assistant text sparingly as progress (first line only).
        if (m.type === "assistant" && m.message?.content) {
          const t = textOf(m.message.content);
          if (t) this.log(dim(`       ${firstLine(t)}`));
        }
      }
      this.mem.setAgentStatus(name, "complete");
    } catch (err) {
      this.mem.setAgentStatus(name, "failed");
      this.log(`       ✗ ${name} errored: ${String((err as any)?.message ?? err)}`);
    }
    return finalText;
  }

  private async dispatchBugfix(task: string, slugName: string): Promise<void> {
    const branch = `bugfix/${slug(slugName)}`;
    if (!this.cfg.noGit) await createBranch(this.cfg.target, branch);
    await this.runAgent("bugfix", task);
    if (!this.cfg.noGit) {
      await commitAll(this.cfg.target, `fix(${slug(slugName)}): targeted bugfix`);
      await mergeToDevelop(this.cfg.target, branch);
    }
  }

  private async escalate(phase: string, message: string): Promise<void> {
    this.log(`\n⛔ Escalation [${phase}]: ${message}`);
    this.mem.recordDecision(`escalation-${phase}`, `# Escalation: ${phase}\n\n${message}\n\nTime: ${new Date().toISOString()}\n`);
  }

  // ── task prompts per agent on a feature ────────────────────────────────

  private featureTask(agent: AgentName, feature: Feature): string {
    const head = `Feature: ${feature.name} — ${feature.description}\nBranch: ${feature.branch}\n`;
    const touches = feature.touches?.length ? `\nLikely files to touch: ${feature.touches.join(", ")}` : "";
    const tasks: Partial<Record<AgentName, string>> = {
      designer: `Produce the design system, tokens, and semantic registry for this feature. Run the design suite first.`,
      frontend: `Implement the UI for this feature using ONLY the published registry + tokens. Add data-testid. Render real data.`,
      backend: `Implement the API, data model, and logic for this feature. Publish/extend .workflow/api-contracts.yaml.`,
      docs: `Document this feature (README/CLAUDE.md/API docs) from the real code.`,
      devops: `Add the infra this feature needs (Docker/CI/env) if applicable.`,
      qa: `Write and run tests for this feature.`,
    };
    return head + touches + "\n\n" + (tasks[agent] ?? `Do your part for this feature as described in your instructions.`);
  }
}

// ── pure helpers ─────────────────────────────────────────────────────────────

/** Order the agents within a feature: designer → backend → frontend → rest. */
function orderedAgents(agents: AgentName[]): AgentName[] {
  const rank: Record<string, number> = { designer: 0, backend: 1, frontend: 2, devops: 3, docs: 4 };
  return [...agents].sort((a, b) => (rank[a] ?? 9) - (rank[b] ?? 9));
}

/** Group features into dependency-respecting parallel waves (topological). */
function topoWaves(features: Feature[]): Feature[][] {
  const byName = new Map(features.map((f) => [f.name, f]));
  const done = new Set<string>();
  const waves: Feature[][] = [];
  let remaining = [...features];
  let guard = 0;
  while (remaining.length && guard++ < 100) {
    const ready = remaining.filter((f) =>
      (f.dependencies ?? []).every((d) => done.has(d) || !byName.has(d)));
    if (!ready.length) { waves.push(remaining); break; } // cycle fallback: run the rest together
    waves.push(ready);
    ready.forEach((f) => done.add(f.name));
    remaining = remaining.filter((f) => !done.has(f.name));
  }
  return waves;
}

async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items];
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (queue.length) { const item = queue.shift()!; await fn(item); }
  });
  await Promise.all(workers);
}

function parseConductor(text: string, threshold: number): ConductorScore {
  const fallback: ConductorScore = { score: 0, breakdown: {}, blocking_issues: [], decision: "iterate", fixes_needed: [] };
  const block = text.match(/```ya?ml\s*([\s\S]*?)```/i)?.[1] ?? extractYamlTail(text);
  if (!block) return fallback;
  try {
    const data = YAML.parse(block) as Partial<ConductorScore>;
    const score = Number(data.score ?? 0);
    return {
      score,
      breakdown: data.breakdown ?? {},
      blocking_issues: data.blocking_issues ?? [],
      decision: (data.decision as any) ?? (score >= threshold ? "pass" : "iterate"),
      fixes_needed: data.fixes_needed ?? [],
    };
  } catch { return fallback; }
}

function extractYamlTail(text: string): string | null {
  const idx = text.lastIndexOf("score:");
  return idx >= 0 ? text.slice(idx) : null;
}

function deriveName(request: string, target: string): string {
  const base = target.split("/").filter(Boolean).pop() ?? "project";
  return slug(base);
}

function nextTag(scope: Scope): string {
  const v = scope.project.version ?? "";
  const m = v.match(/(\d+\.\d+\.\d+)\s*$/);
  return `v${m?.[1] ?? "1.0.0"}`;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "task";
const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const firstLine = (s: string) => s.split("\n").find((l) => l.trim()) ?? "";
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

/** Format a list of env var NAMES for logging (values are never passed here). */
function maskList(names: string[]): string {
  const shown = names.slice(0, 6).join(", ");
  return names.length > 6 ? `${shown}, +${names.length - 6} more` : shown;
}

function textOf(content: any): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.filter((b) => b?.type === "text").map((b) => b.text).join("").trim();
  }
  return "";
}
