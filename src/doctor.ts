// Preflight checks — `webdev doctor`. Since the harness is meant to run on any
// user's machine against any model provider, this verifies the environment is
// actually ready before a build, and explains exactly how to fix what isn't.

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

type Status = "ok" | "warn" | "fail";
interface Check { label: string; status: Status; detail: string; }

function tryCmd(cmd: string, args: string[]): string | null {
  try { return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); }
  catch { return null; }
}

function nodeMajor(): number {
  return parseInt(process.versions.node.split(".")[0], 10);
}

/** Provider-agnostic auth check. The harness only needs the SDK's env vars set;
 *  it does not care WHICH provider they point at (Anthropic API, a proxy,
 *  Bedrock, Vertex, …). */
function checkAuth(): Check {
  const key = process.env.ANTHROPIC_API_KEY;
  const base = process.env.ANTHROPIC_BASE_URL;
  const bedrock = process.env.CLAUDE_CODE_USE_BEDROCK === "1";
  const vertex = process.env.CLAUDE_CODE_USE_VERTEX === "1";

  if (bedrock || vertex) {
    return { label: "Auth", status: "ok", detail: `${bedrock ? "Amazon Bedrock" : "Google Vertex"} mode (provider creds used)` };
  }
  if (key && base) return { label: "Auth", status: "ok", detail: `key + custom base URL (${base})` };
  if (key) return { label: "Auth", status: "ok", detail: "ANTHROPIC_API_KEY set (direct Anthropic API)" };
  if (base && !key) {
    return { label: "Auth", status: "warn", detail: `ANTHROPIC_BASE_URL set (${base}) but no ANTHROPIC_API_KEY — most proxies still need a key value` };
  }
  return {
    label: "Auth",
    status: "fail",
    detail: "no ANTHROPIC_API_KEY. Set one of: ANTHROPIC_API_KEY (direct), ANTHROPIC_API_KEY+ANTHROPIC_BASE_URL (proxy), or CLAUDE_CODE_USE_BEDROCK/VERTEX",
  };
}

export function runDoctor(): number {
  const checks: Check[] = [];

  // Node version (SDK requires 18+).
  const nv = nodeMajor();
  checks.push({
    label: "Node.js",
    status: nv >= 18 ? "ok" : "fail",
    detail: nv >= 18 ? `v${process.versions.node}` : `v${process.versions.node} — SDK needs Node 18+`,
  });

  // Auth.
  checks.push(checkAuth());

  // git (needed unless --no-git).
  const gv = tryCmd("git", ["--version"]);
  checks.push({
    label: "git",
    status: gv ? "ok" : "warn",
    detail: gv ?? "not found — use --no-git, or install git for branch orchestration",
  });

  // Python (optional — design suite scripts + python-stack builds).
  const py = tryCmd("python3", ["--version"]) ?? tryCmd("python", ["--version"]);
  checks.push({
    label: "Python",
    status: py ? "ok" : "warn",
    detail: py ? `${py} (design-suite scripts available)` : "not found — design-suite search scripts won't run; install Python 3 to enable",
  });

  // Docker + compose (conditional — only apps with a SERVER-based database need
  // it). SQLite and static apps need nothing here, so absence is a warning, not
  // a failure. Provisioning runs `docker compose up` for a server DB, so we
  // check the compose SUBCOMMAND too: Docker can be installed while the
  // compose-v2 plugin is missing, which passes a naive `docker --version` check
  // but fails the actual command.
  const dv = tryCmd("docker", ["--version"]);
  const hasCompose = dv
    ? (tryCmd("docker", ["compose", "version"]) !== null || tryCmd("docker-compose", ["--version"]) !== null)
    : false;
  checks.push({
    label: "Docker",
    status: dv && hasCompose ? "ok" : "warn",
    detail: !dv
      ? "not found — only needed if your app uses a server-based database (Postgres/MySQL/Mongo/Redis). SQLite and static apps don't need it."
      : hasCompose
        ? `${dv} + compose (server-based databases can run locally)`
        : `${dv} but 'docker compose' is unavailable — install the Compose v2 plugin, or server-based DB provisioning will fail.`,
  });

  // curl — the runtime boot-probe uses it to check the app is serving HTTP.
  // Without it the probe can't confirm the app booted (server-based apps only;
  // static/library builds don't run a probe).
  const cv = tryCmd("curl", ["--version"]);
  checks.push({
    label: "curl",
    status: cv ? "ok" : "warn",
    detail: cv
      ? `${(cv.split("\n")[0] || "curl").slice(0, 40)} (boot probe can verify the app serves)`
      : "not found — the runtime boot-probe needs curl to confirm the app started; install curl if you build server apps.",
  });

  // Design suite installed into ~/.claude/skills?
  const skillsDir = join(homedir(), ".claude", "skills");
  const required = ["ui-ux-pro-max", "design-system", "brand", "ui-styling"];
  const present = required.filter((s) => existsSync(join(skillsDir, s)));
  checks.push({
    label: "Design suite",
    status: present.length === required.length ? "ok" : present.length ? "warn" : "fail",
    detail: present.length === required.length
      ? `all ${required.length} skills in ~/.claude/skills`
      : `${present.length}/${required.length} present — run \`webdev install-skills\` to install ${required.filter((s) => !present.includes(s)).join(", ")}`,
  });

  // Render.
  const icon = (s: Status) => (s === "ok" ? "✓" : s === "warn" ? "▲" : "✗");
  const color = (s: Status, t: string) =>
    s === "ok" ? `\x1b[32m${t}\x1b[0m` : s === "warn" ? `\x1b[33m${t}\x1b[0m` : `\x1b[31m${t}\x1b[0m`;

  console.log("\nwebdev doctor — environment preflight\n");
  for (const c of checks) {
    console.log(`  ${color(c.status, icon(c.status))} ${c.label.padEnd(14)} ${c.detail}`);
  }

  const failed = checks.filter((c) => c.status === "fail");
  const warned = checks.filter((c) => c.status === "warn");
  console.log("");
  if (failed.length) {
    console.log(`\x1b[31m${failed.length} blocking issue(s)\x1b[0m — fix these before building.\n`);
    return 1;
  }
  if (warned.length) {
    console.log(`\x1b[33m${warned.length} warning(s)\x1b[0m — builds will run, some features may be limited.\n`);
    return 0;
  }
  console.log("\x1b[32mAll checks passed — ready to build.\x1b[0m\n");
  return 0;
}
