// Code-driven deploy — the harness ships the app itself, WITHOUT ever handing
// cloud credentials to an LLM agent.
//
// The split is deliberate and matches the env-provisioning design:
//   - the devops AGENT PLANS: it picks platforms and writes a machine-readable
//     recipe (.workflow/deploy-plan.yaml) — CLI per component, ordered steps,
//     the NAMES of the credentials each needs. No secret value is ever in it.
//   - this deterministic CODE EXECUTES: it collects those credentials via masked
//     prompt (values live only in this process), injects them into each CLI's
//     child-process env (never to disk, never to an agent's context/transcript),
//     and runs the steps in dependency order.
//
// If anything is missing (no TTY to prompt, a required CLI absent, the user
// declines), it falls back to config-only — exactly today's behavior — so the
// user still has DEPLOY.md to finish by hand.

import { execFileSync } from "node:child_process";
import type { DeployComponent, DeployPlan } from "./types.ts";
import { run, shellQuote } from "./verify.ts";
import { maskedQuestion } from "./env.ts";

// Steps announce an output a dependent component consumes by printing this
// sentinel (mirrors verify.ts's __PROBE_OK__ convention): `__PROVIDE__ VAR=value`.
// We also fall back to scanning for a bare `VAR=value` line for a provided name.
const PROVIDE_MARKER = "__PROVIDE__";

// ── CLI preflight (tryCmd pattern from doctor.ts) ────────────────────────────

function cliPresent(tool: string, versionArg = "--version"): boolean {
  try {
    execFileSync(tool, [versionArg], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return true;
  } catch {
    return false;
  }
}

/** Return the components whose required CLI is not installed. */
export function preflightClis(plan: DeployPlan): { tool: string; platform: string }[] {
  const missing: { tool: string; platform: string }[] = [];
  const seen = new Set<string>();
  for (const c of plan.components ?? []) {
    const tool = c.cli?.tool;
    if (!tool || seen.has(tool)) continue;
    seen.add(tool);
    if (!cliPresent(tool, c.cli?.version_arg)) missing.push({ tool, platform: c.platform });
  }
  return missing;
}

// ── credential collection (masked; never logged, never sent to an agent) ─────

/**
 * Prompt (masked) for each credential the plan declares, skipping any already
 * present in the environment. Returns the collected map, or `null` when we
 * cannot prompt (no TTY / non-interactive) — the caller then falls back to
 * config-only. Values returned here are held in memory by the caller only.
 */
export async function collectDeploySecrets(
  plan: DeployPlan,
  nonInteractive: boolean,
): Promise<Record<string, string> | null> {
  const declared = plan.prompt_secrets ?? [];
  const needed = declared.filter((s) => !process.env[s.name]);
  if (!needed.length) return {}; // everything already in env — nothing to prompt

  if (nonInteractive) return null; // no way to collect safely → signal fallback

  process.stdout.write(
    "\n🔐 Deploy needs cloud credentials. Paste each token (input hidden), or press Enter to abort the deploy.\n" +
    "   (Collected by the harness and injected straight into each CLI — they never reach any AI agent.)\n\n",
  );
  const collected: Record<string, string> = {};
  for (const s of needed) {
    const value = (await maskedQuestion(`   ${s.name}${s.purpose ? ` (${s.purpose})` : ""}: `)).trim();
    if (!value) return null; // user aborted → fall back to config-only
    collected[s.name] = value;
  }
  process.stdout.write("\n");
  return collected;
}

// ── ordering ─────────────────────────────────────────────────────────────────

/** Order components so every `needs` dependency runs first. Throws on a cycle
 *  or a dangling dependency so we never run a half-wired deploy. */
export function orderComponents(components: DeployComponent[]): DeployComponent[] {
  const byName = new Map(components.map((c) => [c.name, c]));
  const ordered: DeployComponent[] = [];
  const state = new Map<string, "visiting" | "done">();

  const visit = (c: DeployComponent, trail: string[]): void => {
    const s = state.get(c.name);
    if (s === "done") return;
    if (s === "visiting") throw new Error(`deploy-plan.yaml: dependency cycle at "${c.name}" (${trail.join(" → ")})`);
    state.set(c.name, "visiting");
    for (const dep of c.needs ?? []) {
      const d = byName.get(dep);
      if (!d) throw new Error(`deploy-plan.yaml: "${c.name}" needs "${dep}", which is not a component`);
      visit(d, [...trail, dep]);
    }
    state.set(c.name, "done");
    ordered.push(c);
  };

  for (const c of components) visit(c, [c.name]);
  return ordered;
}

// ── step interpolation + output capture ──────────────────────────────────────

/** Replace every `${VAR}` in a step with the shell-quoted value from `values`.
 *  Returns the runnable command, plus any placeholder we couldn't resolve (we
 *  refuse to run a partially-substituted command). */
function resolveStep(step: string, values: Record<string, string>): { cmd: string; missing: string[] } {
  const missing: string[] = [];
  const cmd = step.replace(/\$\{([A-Z0-9_]+)\}/gi, (_m, name: string) => {
    const v = values[name];
    if (v === undefined) { missing.push(name); return ""; }
    return shellQuote(v);
  });
  return { cmd, missing };
}

/** Pull `__PROVIDE__ VAR=value` sentinels (and bare `VAR=value` fallbacks for
 *  declared names) out of a step's stdout. */
function captureProvides(stdout: string, provides: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of stdout.split("\n")) {
    const t = line.trim();
    const marked = t.startsWith(PROVIDE_MARKER) ? t.slice(PROVIDE_MARKER.length).trim() : null;
    const m = (marked ?? t).match(/^([A-Z0-9_]+)=(.+)$/i);
    if (m && (marked || provides.includes(m[1]))) out[m[1]] = m[2].trim();
  }
  return out;
}

/** First https URL in the output — reported to the user and used to wire a
 *  dependent (e.g. the frontend's API base URL → the backend's deployed URL). */
function firstUrl(stdout: string): string | undefined {
  return stdout.match(/https?:\/\/[^\s"'<>]+/)?.[0];
}

/** Redact any secret value that would otherwise appear in a log line. */
function redact(text: string, secrets: Record<string, string>): string {
  let out = text;
  for (const v of Object.values(secrets)) {
    if (v && v.length >= 4) out = out.split(v).join("••••");
  }
  return out;
}

// ── execution ─────────────────────────────────────────────────────────────────

export interface DeployOutcome {
  ok: boolean;
  deployed: { name: string; platform: string; url?: string }[];
  failed?: { name: string; platform: string; step: string; detail: string };
}

/**
 * Run the plan in dependency order. Credentials + prior components' `provides`
 * are injected into each step's child-process env; steps are logged with their
 * `${VAR}` placeholders UN-expanded so no secret is printed. Stops at the first
 * failing step and reports it (masked), leaving DEPLOY.md for manual recovery.
 */
export async function executeDeployPlan(
  plan: DeployPlan,
  cwd: string,
  secrets: Record<string, string>,
  log: (line: string) => void,
): Promise<DeployOutcome> {
  const ordered = orderComponents(plan.components ?? []);
  // Accumulates collected credentials + every component's captured provides.
  const values: Record<string, string> = { ...secrets };
  const deployed: { name: string; platform: string; url?: string }[] = [];

  for (const c of ordered) {
    log(`   → ${c.name} (${c.platform})…`);
    let componentUrl: string | undefined;

    for (const step of c.steps ?? []) {
      const { cmd, missing } = resolveStep(step, values);
      if (missing.length) {
        return {
          ok: false, deployed,
          failed: { name: c.name, platform: c.platform, step, detail: `unresolved ${missing.join(", ")} — a prior step must provide it` },
        };
      }
      // Inject only this component's declared env names (creds + upstream provides).
      const childEnv: NodeJS.ProcessEnv = {};
      for (const name of [...(c.env ?? []), ...(c.secrets ?? [])]) {
        if (values[name] !== undefined) childEnv[name] = values[name];
      }
      const res = await run("bash", ["-lc", cmd], { cwd, timeoutMs: 600_000, env: childEnv });
      if (res.code !== 0) {
        return {
          ok: false, deployed,
          failed: { name: c.name, platform: c.platform, step, detail: redact(res.stderr || res.stdout, secrets).slice(-800) },
        };
      }
      Object.assign(values, captureProvides(res.stdout, c.provides ?? []));
      componentUrl = firstUrl(res.stdout) ?? componentUrl;
    }
    deployed.push({ name: c.name, platform: c.platform, url: componentUrl });
    log(`     ✓ ${c.name} deployed${componentUrl ? ` → ${componentUrl}` : ""}`);
  }

  return { ok: true, deployed };
}
