// Verification + git helpers used by the orchestrator between phases.
// These are deterministic checks the PM runs itself (not delegated to agents)
// so "compiles" and "the merge didn't break the server" are real, code-checked
// facts rather than an agent's claim.

import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import type { PhaseResult } from "./types.ts";

const exec = promisify(execFile);

interface RunOpts {
  cwd: string;
  timeoutMs?: number;
  /** Extra env vars merged over process.env for the child — lets deterministic
   *  code inject collected deploy credentials into a CLI without writing them to
   *  disk or passing them through any agent's context. */
  env?: NodeJS.ProcessEnv;
}

/** Run a shell command, never throwing — returns code/stdout/stderr. */
export async function run(
  cmd: string,
  args: string[],
  { cwd, timeoutMs = 120_000, env }: RunOpts,
): Promise<{ code: number; stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await exec(cmd, args, {
      cwd,
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
      env: env ? { ...process.env, ...env } : process.env,
    });
    return { code: 0, stdout, stderr };
  } catch (err: any) {
    return {
      code: typeof err.code === "number" ? err.code : 1,
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? String(err?.message ?? err),
    };
  }
}

/** Run a raw shell line via `bash -lc` (for chained/scripted commands). */
export async function sh(line: string, opts: RunOpts) {
  return run("bash", ["-lc", line], opts);
}

// ── Build detection ────────────────────────────────────────────────────────

interface PkgScripts { build?: string; test?: string; lint?: string; typecheck?: string; dev?: string; start?: string; }

export function readPkgScripts(cwd: string): PkgScripts {
  const p = join(cwd, "package.json");
  if (!existsSync(p)) return {};
  try { return (JSON.parse(readFileSync(p, "utf8")).scripts ?? {}) as PkgScripts; }
  catch { return {}; }
}

/** Best-effort build command for the detected stack. Returns null if none. */
export function detectBuildCommand(cwd: string): string | null {
  const scripts = readPkgScripts(cwd);
  if (scripts.build) return "npm run build";
  if (scripts.typecheck) return "npm run typecheck";
  if (existsSync(join(cwd, "tsconfig.json"))) return "npx tsc --noEmit";
  if (existsSync(join(cwd, "Cargo.toml"))) return "cargo build";
  if (existsSync(join(cwd, "go.mod"))) return "go build ./...";
  if (existsSync(join(cwd, "pyproject.toml")) || existsSync(join(cwd, "requirements.txt"))) {
    return "python -m compileall -q .";
  }
  return null;
}

export function detectTestCommand(cwd: string): string | null {
  const scripts = readPkgScripts(cwd);
  if (scripts.test) return "npm test";
  if (existsSync(join(cwd, "pytest.ini")) || existsSync(join(cwd, "pyproject.toml"))) return "pytest -q";
  if (existsSync(join(cwd, "Cargo.toml"))) return "cargo test";
  return null;
}

/** Compile/build gate. Skips cleanly (ok:true) when there's nothing to build yet. */
export async function buildGate(cwd: string): Promise<PhaseResult> {
  const cmd = detectBuildCommand(cwd);
  if (!cmd) return { phase: "build", ok: true, detail: "no build step detected (skipped)" };
  // Install deps first if a manifest exists but node_modules doesn't.
  if (existsSync(join(cwd, "package.json")) && !existsSync(join(cwd, "node_modules"))) {
    await sh("npm install --no-audit --no-fund", { cwd, timeoutMs: 300_000 });
  }
  const res = await sh(cmd, { cwd, timeoutMs: 300_000 });
  return {
    phase: "build",
    ok: res.code === 0,
    detail: res.code === 0 ? `${cmd} ✓` : tail(res.stderr || res.stdout, 1800),
  };
}

/** Best-effort command to START the built app (not build it). start > dev. */
export function detectStartCommand(cwd: string): string | null {
  const scripts = readPkgScripts(cwd);
  if (scripts.start) return "npm run start";
  if (scripts.dev) return "npm run dev";
  return null;
}

/**
 * Runtime probe: actually BOOT the app and confirm it serves HTTP, then stop it.
 * This catches "compiles but crashes on boot" — most importantly a failed
 * database connection at startup — before the heavier E2E phase. The server is
 * backgrounded in its own process group, polled for readiness, and always
 * killed (so it can never hang the build). A response of ANY status (even 404)
 * proves the server came up; only a total failure-to-listen is a failure.
 *
 * Returns ok:true (skipped) when there's no start command or no reachable port
 * concept — a static site or library has nothing to boot, which is not a fault.
 */
export async function runtimeProbe(cwd: string, port: number): Promise<PhaseResult> {
  const startCmd = detectStartCommand(cwd);
  if (!startCmd) return { phase: "runtime-probe", ok: true, detail: "no start command (skipped)" };

  // One self-contained bash script: launch in a new process group, poll the
  // port for up to ~40s, capture logs, then kill the whole group unconditionally.
  const script = `
set -m
: > /tmp/webdev-run.log
( ${startCmd} > /tmp/webdev-run.log 2>&1 ) &
APP_PID=$!
ready=0
for i in $(seq 1 40); do
  if ! kill -0 "$APP_PID" 2>/dev/null; then break; fi   # process died → stop polling
  if curl -sf -o /dev/null "http://localhost:${port}" 2>/dev/null \
     || curl -s -o /dev/null -w '%{http_code}' "http://localhost:${port}" 2>/dev/null | grep -qE '^[1-5][0-9][0-9]$'; then
    ready=1; break
  fi
  sleep 1
done
kill -TERM -"$APP_PID" 2>/dev/null || kill "$APP_PID" 2>/dev/null || true
sleep 1
kill -KILL -"$APP_PID" 2>/dev/null || true
if [ "$ready" = "1" ]; then echo "__PROBE_OK__"; else echo "__PROBE_FAIL__"; tail -c 1500 /tmp/webdev-run.log; fi
`;
  const res = await sh(script, { cwd, timeoutMs: 90_000 });
  const ok = res.stdout.includes("__PROBE_OK__");
  return {
    phase: "runtime-probe",
    ok,
    detail: ok
      ? `app booted and served on :${port} ✓`
      : `app failed to serve on :${port} within timeout (often a DB-connection or startup crash):\n${tail(res.stdout, 1500)}`,
  };
}

// ── Git orchestration ────────────────────────────────────────────────────────

export async function isGitRepo(cwd: string): Promise<boolean> {
  const r = await run("git", ["rev-parse", "--is-inside-work-tree"], { cwd });
  return r.code === 0 && r.stdout.trim() === "true";
}

/** Initialize the git flow: repo + main/develop branches + initial commit. */
export async function bootstrapGit(cwd: string): Promise<void> {
  if (!(await isGitRepo(cwd))) {
    await run("git", ["init", "-b", "main"], { cwd });
    // Only set identity locally if none is configured, to avoid touching global config.
    const who = await run("git", ["config", "user.email"], { cwd });
    if (!who.stdout.trim()) {
      await run("git", ["config", "user.email", "webdev-orchestrator@local"], { cwd });
      await run("git", ["config", "user.name", "webdev-orchestrator"], { cwd });
    }
  }
  // Ensure at least one commit exists so branches can be created.
  const head = await run("git", ["rev-parse", "HEAD"], { cwd });
  if (head.code !== 0) {
    await sh("git add -A && git commit -m 'chore: initial commit' --no-verify --allow-empty", { cwd });
  }
  // Ensure develop exists and is checked out.
  const branches = await run("git", ["branch", "--list", "develop"], { cwd });
  if (!branches.stdout.includes("develop")) {
    await run("git", ["checkout", "-b", "develop"], { cwd });
  } else {
    await run("git", ["checkout", "develop"], { cwd });
  }
}

export async function createBranch(cwd: string, branch: string, base = "develop"): Promise<void> {
  await run("git", ["checkout", base], { cwd });
  // Reuse the branch if it already exists (resume), else create it.
  const exists = await run("git", ["rev-parse", "--verify", branch], { cwd });
  await run("git", ["checkout", exists.code === 0 ? branch : "-b", branch], { cwd });
}

export async function commitAll(cwd: string, message: string): Promise<void> {
  await run("git", ["add", "-A"], { cwd });
  await sh(`git commit -m ${shellQuote(message)} --no-verify`, { cwd }); // no-op if nothing staged
}

export async function mergeToDevelop(cwd: string, branch: string): Promise<void> {
  await run("git", ["checkout", "develop"], { cwd });
  await run("git", ["merge", branch, "--no-edit", "--no-verify"], { cwd });
}

export async function releaseToMain(cwd: string, tag: string): Promise<void> {
  await run("git", ["checkout", "main"], { cwd });
  await run("git", ["merge", "develop", "--no-edit", "--no-verify"], { cwd });
  await run("git", ["tag", tag], { cwd });
  await run("git", ["checkout", "develop"], { cwd });
}

// ── helpers ──────────────────────────────────────────────────────────────────

function tail(s: string, n: number): string {
  return s.length > n ? "…" + s.slice(-n) : s;
}

export function shellQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}
