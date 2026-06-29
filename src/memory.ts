// File-based memory — replaces the aimem MCP server entirely.
//
// Two scopes:
//   1. Project-local  <target>/.workflow/   — coordination + handoffs for THIS build
//   2. Global vault    ~/.claude/webdev-memory/ — cross-project learning
//
// Agents coordinate by reading/writing structured files here. The orchestrator
// (real code) is the only writer of state.yaml; agents publish their outputs
// (registry, contracts, reports) which downstream agents read as the single
// source of truth.

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, appendFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import YAML from "yaml";
import type { Scope } from "./types.ts";

export const WORKFLOW_DIR = ".workflow";
const VAULT_DIR = join(homedir(), ".claude", "webdev-memory");

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function readYaml<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;
  try {
    return (YAML.parse(readFileSync(path, "utf8")) as T) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeYaml(path: string, value: unknown): void {
  ensureDir(join(path, ".."));
  writeFileSync(path, YAML.stringify(value), "utf8");
}

// ─────────────────────────────────────────────────────────────────────────
// Build state — owned by the orchestrator, readable by every agent.
// ─────────────────────────────────────────────────────────────────────────

export interface BuildState {
  project: string;
  mode: string;
  version?: string;
  phase: string;
  started_at: string;
  updated_at: string;
  semantic_registry_ready: boolean;
  api_contracts_ready: boolean;
  design_system_ready: boolean;
  agents: Record<string, "pending" | "in_progress" | "complete" | "failed">;
  features_merged: string[];
  iterations: number;
}

export class Memory {
  readonly root: string; // <target>/.workflow
  readonly target: string;

  constructor(target: string) {
    this.target = target;
    this.root = join(target, WORKFLOW_DIR);
    ensureDir(this.root);
    ensureDir(join(this.root, "decisions"));
    ensureDir(join(this.root, "reports"));
    ensureDir(VAULT_DIR);
    ensureDir(join(VAULT_DIR, "patterns"));
  }

  // -- paths agents reference by convention -------------------------------
  get statePath() { return join(this.root, "state.yaml"); }
  get scopePath() { return join(this.root, "scope.yaml"); }
  get registryPath() { return join(this.root, "semantic-registry.yaml"); }
  get contractsPath() { return join(this.root, "api-contracts.yaml"); }
  get designSystemDir() { return join(this.root, "design-system"); }

  // -- state --------------------------------------------------------------
  readState(): BuildState | null {
    return existsSync(this.statePath) ? readYaml<BuildState | null>(this.statePath, null) : null;
  }

  writeState(state: BuildState): void {
    state.updated_at = new Date().toISOString();
    writeYaml(this.statePath, state);
  }

  initState(partial: Pick<BuildState, "project" | "mode" | "version">): BuildState {
    const existing = this.readState();
    const now = new Date().toISOString();
    const state: BuildState = existing ?? {
      ...partial,
      phase: "init",
      started_at: now,
      updated_at: now,
      semantic_registry_ready: false,
      api_contracts_ready: false,
      design_system_ready: false,
      agents: {},
      features_merged: [],
      iterations: 0,
    };
    // Refresh identifying fields on resume.
    state.project = partial.project;
    state.mode = partial.mode;
    state.version = partial.version;
    this.writeState(state);
    return state;
  }

  setPhase(phase: string): void {
    const s = this.readState();
    if (s) { s.phase = phase; this.writeState(s); }
  }

  setAgentStatus(agent: string, status: BuildState["agents"][string]): void {
    const s = this.readState();
    if (!s) return;
    s.agents[agent] = status;
    this.writeState(s);
  }

  markFeatureMerged(feature: string): void {
    const s = this.readState();
    if (!s) return;
    if (!s.features_merged.includes(feature)) s.features_merged.push(feature);
    this.writeState(s);
  }

  // -- scope --------------------------------------------------------------
  readScope(): Scope | null {
    return existsSync(this.scopePath) ? readYaml<Scope | null>(this.scopePath, null) : null;
  }
  writeScope(scope: Scope): void { writeYaml(this.scopePath, scope); }

  // -- design-system readiness (designer publishes registry + contracts) --
  refreshReadiness(): void {
    const s = this.readState();
    if (!s) return;
    s.semantic_registry_ready = existsSync(this.registryPath);
    s.api_contracts_ready = existsSync(this.contractsPath);
    s.design_system_ready = existsSync(join(this.designSystemDir, "MASTER.md"));
    this.writeState(s);
  }

  // -- decisions ----------------------------------------------------------
  recordDecision(slug: string, body: string): void {
    const path = join(this.root, "decisions", `${slug}.md`);
    writeFileSync(path, body, "utf8");
  }

  // -- reports (agent outputs the orchestrator collects) ------------------
  reportPath(name: string): string {
    return join(this.root, "reports", `${name}.md`);
  }
  readReport(name: string): string | null {
    const p = this.reportPath(name);
    return existsSync(p) ? readFileSync(p, "utf8") : null;
  }
  listReports(): string[] {
    const dir = join(this.root, "reports");
    return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".md")) : [];
  }

  // ───────────────────────────────────────────────────────────────────────
  // Global vault — cross-project learning (replaces aimem conductor vault).
  // ───────────────────────────────────────────────────────────────────────

  static vaultBenchmarks(): { p50: number; p75: number; p90: number; samples: number } {
    const path = join(VAULT_DIR, "benchmarks.json");
    if (!existsSync(path)) return { p50: 92, p75: 95, p90: 98, samples: 0 };
    try { return JSON.parse(readFileSync(path, "utf8")); }
    catch { return { p50: 92, p75: 95, p90: 98, samples: 0 }; }
  }

  static vaultFailurePatterns(): { pattern: string; frequency: number; typical_fix: string }[] {
    const path = join(VAULT_DIR, "failure-patterns.json");
    if (!existsSync(path)) return [];
    try { return JSON.parse(readFileSync(path, "utf8")); }
    catch { return []; }
  }

  /** Append a finished project's outcome and recompute benchmarks. */
  static recordProjectOutcome(outcome: {
    project: string;
    mode: string;
    final_score: number;
    iterations: number;
    issues: string[];
  }): void {
    ensureDir(VAULT_DIR);
    appendFileSync(
      join(VAULT_DIR, "projects.jsonl"),
      JSON.stringify({ ...outcome, at: new Date().toISOString() }) + "\n",
      "utf8",
    );

    // Recompute score percentiles from history.
    const scores = Memory.allScores();
    if (scores.length) {
      const sorted = [...scores].sort((a, b) => a - b);
      const pct = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
      writeFileSync(
        join(VAULT_DIR, "benchmarks.json"),
        JSON.stringify({ p50: pct(50), p75: pct(75), p90: pct(90), samples: sorted.length }, null, 2),
        "utf8",
      );
    }

    // Roll up issue frequencies into failure patterns.
    const counts = new Map<string, number>();
    for (const issue of outcome.issues) counts.set(issue, (counts.get(issue) ?? 0) + 1);
    const existing = Memory.vaultFailurePatterns();
    for (const [pattern, freq] of counts) {
      const hit = existing.find((e) => e.pattern === pattern);
      if (hit) hit.frequency += freq;
      else existing.push({ pattern, frequency: freq, typical_fix: "" });
    }
    existing.sort((a, b) => b.frequency - a.frequency);
    writeFileSync(join(VAULT_DIR, "failure-patterns.json"), JSON.stringify(existing.slice(0, 50), null, 2), "utf8");
  }

  private static allScores(): number[] {
    const path = join(VAULT_DIR, "projects.jsonl");
    if (!existsSync(path)) return [];
    return readFileSync(path, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => { try { return JSON.parse(l).final_score as number; } catch { return NaN; } })
      .filter((n) => Number.isFinite(n));
  }

  /** A compact briefing the PM injects into the discovery/conductor prompts. */
  static vaultBriefing(): string {
    const b = Memory.vaultBenchmarks();
    const fails = Memory.vaultFailurePatterns().slice(0, 8);
    const lines = [
      `Quality benchmarks from ${b.samples} past build(s): p50=${b.p50}, p75=${b.p75}, p90=${b.p90}.`,
    ];
    if (fails.length) {
      lines.push("Most common failure patterns to pre-empt:");
      for (const f of fails) lines.push(`  - ${f.pattern} (seen ${f.frequency}×)${f.typical_fix ? ` → ${f.typical_fix}` : ""}`);
    }
    return lines.join("\n");
  }

  static get vaultDir(): string { return VAULT_DIR; }
}
