// CLI entry point for the webdev orchestrator.
//
//   webdev "build me a recipe-sharing app"
//   webdev "add CSV export" --mode iteration --preset diverse
//   webdev "cards aren't showing" --mode bugfix --target ./my-app
//   webdev "build X" --model-build claude-opus-4-8 --model-review glm-5
//   webdev models                    # show the resolved lane→model map
//   webdev models --probe            # test which model IDs your proxy accepts
//   webdev install-skills            # copy the bundled design suite into ~/.claude/skills
//
// Auth: the SDK reads ANTHROPIC_BASE_URL / ANTHROPIC_API_KEY from the env. The
// user runs a local proxy (base http://localhost:8000), so we don't override
// those unless they're entirely missing.

import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { Orchestrator } from "./orchestrator.ts";
import { detectMode } from "./modes.ts";
import { runDoctor } from "./doctor.ts";
import {
  resolveLaneModels, laneSummary, PRESETS, MODEL_IDS, LANES,
  type Lane, type LaneModels, type PresetName,
} from "./models.ts";
import type { Mode, RunConfig } from "./types.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HARNESS_ROOT = resolve(__dirname, "..");

const MODES: Mode[] = ["greenfield", "iteration", "bugfix", "refactor", "ui-polish", "migration", "audit"];
const PRESET_NAMES: PresetName[] = ["balanced", "diverse", "solo"];

interface Flags {
  mode?: Mode;
  target: string;
  preset?: PresetName;
  /** Legacy single-model (only honored with --preset solo). */
  model: string;
  /** Per-lane overrides via --model-<lane>. */
  laneOverrides: Partial<LaneModels>;
  threshold: number;
  noGit: boolean;
  fast: boolean;
  yes: boolean;
  concurrency: number;
}

function parseArgs(argv: string[]): { request: string; flags: Flags } {
  const positional: string[] = [];
  const flags: Flags = {
    target: process.cwd(),
    model: "inherit",
    laneOverrides: {},
    threshold: 98,
    noGit: false,
    fast: false,
    yes: false,
    concurrency: 3,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    // --model-<lane> per-lane override (e.g. --model-build, --model-review).
    const laneMatch = a.match(/^--model-(\w+)$/);
    if (laneMatch && LANES.includes(laneMatch[1] as Lane)) {
      flags.laneOverrides[laneMatch[1] as Lane] = next(); continue;
    }
    switch (a) {
      case "--mode": case "-m": {
        const v = next() as Mode;
        if (!MODES.includes(v)) die(`Unknown mode "${v}". One of: ${MODES.join(", ")}`);
        flags.mode = v; break;
      }
      case "--preset": case "-p": {
        const v = next() as PresetName;
        if (!PRESET_NAMES.includes(v)) die(`Unknown preset "${v}". One of: ${PRESET_NAMES.join(", ")}`);
        flags.preset = v; break;
      }
      case "--target": case "-t": flags.target = resolveTarget(next()); break;
      case "--model": flags.model = next(); break;
      case "--threshold": flags.threshold = clamp(Number(next()), 1, 100); break;
      case "--concurrency": case "-c": flags.concurrency = clamp(Number(next()), 1, 16); break;
      case "--no-git": flags.noGit = true; break;
      case "--fast": flags.fast = true; break;
      case "--yes": case "-y": flags.yes = true; break;
      case "--help": case "-h": printHelp(); process.exit(0);
      default:
        if (a.startsWith("-")) die(`Unknown flag: ${a}`);
        positional.push(a);
    }
  }
  return { request: positional.join(" ").trim(), flags };
}

function resolveTarget(p: string): string {
  if (!p) die("--target needs a path");
  const abs = isAbsolute(p) ? p : resolve(process.cwd(), p);
  if (!existsSync(abs)) mkdirSync(abs, { recursive: true });
  return abs;
}

// ── skills installer ─────────────────────────────────────────────────────────

function installSkills(): void {
  const src = join(HARNESS_ROOT, ".claude", "skills");
  const dest = join(homedir(), ".claude", "skills");
  if (!existsSync(src)) die(`No bundled skills at ${src}.`);
  mkdirSync(dest, { recursive: true });
  const skills = readdirSync(src, { withFileTypes: true }).filter((d) => d.isDirectory());
  for (const s of skills) {
    cpSync(join(src, s.name), join(dest, s.name), { recursive: true });
    console.log(`  ✓ ${s.name}`);
  }
  console.log(`\nInstalled ${skills.length} design-suite skill(s) into ${dest}`);
}

// ── setup: one-shot onboarding (install skills, then preflight) ───────────────

function setupCommand(): void {
  console.log("Setting up webdev…\n");
  console.log("1) Installing the design suite into ~/.claude/skills:");
  installSkills();
  console.log("\n2) Checking your environment:");
  runDoctor();
  console.log(
    "Next: set your model auth, then build.\n" +
    "  • Direct Anthropic API:  export ANTHROPIC_API_KEY=sk-ant-...\n" +
    "  • Via a proxy/gateway:   export ANTHROPIC_API_KEY=<key>  ANTHROPIC_BASE_URL=<url>\n" +
    "  • Bedrock / Vertex:      export CLAUDE_CODE_USE_BEDROCK=1  (or CLAUDE_CODE_USE_VERTEX=1)\n\n" +
    "Then:  webdev \"build a markdown notes app\"\n",
  );
}

// ── models subcommand (show + probe) ─────────────────────────────────────────

async function modelsCommand(argv: string[]): Promise<void> {
  const probe = argv.includes("--probe");
  const flagIdx = (() => {
    const i = argv.indexOf("--preset");
    return i >= 0 ? i : argv.indexOf("-p");
  })();
  const presetArg = flagIdx >= 0 ? (argv[flagIdx + 1] as PresetName | undefined) : undefined;
  const preset: PresetName = PRESET_NAMES.includes(presetArg as PresetName) ? presetArg! : "balanced";

  const { models, warnings } = resolveLaneModels({ preset });
  console.log(`\nLane → model map (preset: ${preset}):\n${laneSummary(models)}`);
  for (const w of warnings) console.log(`  ⚠ ${w}`);

  if (!probe) {
    console.log(`\nTo test which model IDs your proxy accepts:  webdev models --probe\n`);
    return;
  }

  // Probe: send a 1-token request to each candidate ID and report what answers.
  const { query } = await import("@anthropic-ai/claude-agent-sdk");
  const candidates = Array.from(new Set([...Object.values(MODEL_IDS), ...Object.values(models)]));
  console.log(`\nProbing ${candidates.length} model IDs against the proxy (this calls the API once each)…\n`);

  for (const id of candidates) {
    process.stdout.write(`  ${id.padEnd(24)} `);
    try {
      let ok = false;
      for await (const msg of query({
        prompt: "Reply with the single word: ok",
        options: { model: id, maxTurns: 1, allowedTools: [], settingSources: [] } as any,
      })) {
        if ((msg as any).type === "result") {
          ok = (msg as any).subtype === "success";
          break;
        }
      }
      console.log(ok ? "✓ accepted" : "✗ rejected");
    } catch (err) {
      console.log(`✗ ${shortErr(err)}`);
    }
  }
  console.log(
    `\nUse the accepted IDs in ~/.claude/webdev-models.json or via --model-<lane>.\n` +
    `Lanes: ${LANES.join(", ")}.\n`,
  );
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (!argv.length) { printHelp(); process.exit(0); }
  if (argv[0] === "doctor") { process.exit(runDoctor()); }
  if (argv[0] === "install-skills") { installSkills(); return; }
  if (argv[0] === "setup") { setupCommand(); return; }
  if (argv[0] === "models") { await modelsCommand(argv.slice(1)); return; }

  const { request, flags } = parseArgs(argv);
  if (!request) die("Tell me what to build. e.g.  webdev \"build a habit tracker\"");

  ensureAuthEnv();

  const hasCode = looksLikeExistingProject(flags.target);
  const mode = flags.mode ?? detectMode(request, hasCode);

  // Resolve the per-lane model assignment.
  const { models, preset, warnings } = resolveLaneModels({
    preset: flags.preset,
    overrides: flags.laneOverrides,
    globalModel: flags.model,
  });
  for (const w of warnings) console.warn(`⚠  ${w}`);

  const config: RunConfig = {
    request, mode,
    target: flags.target,
    laneModels: models,
    preset,
    threshold: flags.threshold,
    noGit: flags.noGit,
    fast: flags.fast,
    yes: flags.yes,
    concurrency: flags.concurrency,
  };

  const orch = new Orchestrator(config, (line) => console.log(line));
  const result = await orch.run();
  console.log(`\n${result.ok ? "✅" : "⚠️ "} ${result.summary}`);
  process.exit(result.ok ? 0 : 1);
}

function ensureAuthEnv(): void {
  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);
  const hasProvider =
    process.env.CLAUDE_CODE_USE_BEDROCK === "1" || process.env.CLAUDE_CODE_USE_VERTEX === "1";
  if (hasKey || hasProvider) return;
  console.warn(
    "⚠  No model auth detected. The harness sends model requests to whatever you configure —\n" +
    "   it doesn't bundle any provider. Set one of:\n" +
    "     • export ANTHROPIC_API_KEY=sk-ant-...                 (direct Anthropic API)\n" +
    "     • export ANTHROPIC_API_KEY=<key> ANTHROPIC_BASE_URL=<url>   (proxy / gateway)\n" +
    "     • export CLAUDE_CODE_USE_BEDROCK=1   (or CLAUDE_CODE_USE_VERTEX=1)\n" +
    "   Run `webdev doctor` to verify.\n",
  );
}

function looksLikeExistingProject(dir: string): boolean {
  const markers = ["package.json", "Cargo.toml", "go.mod", "pyproject.toml", "requirements.txt", "src", "app", "index.html"];
  return existsSync(dir) && markers.some((m) => existsSync(join(dir, m)));
}

function printHelp(): void {
  console.log(`
webdev — multi-agent web-development orchestrator (Claude Agent SDK)

USAGE
  webdev "<what to build>" [options]
  webdev setup                            One-shot onboarding: install skills + preflight
  webdev doctor                           Check the environment is ready to build
  webdev models [--probe] [-p <preset>]   Show the lane→model map (or probe the provider)
  webdev install-skills                   Copy the bundled design suite into ~/.claude/skills

OPTIONS
  -m, --mode <mode>        ${MODES.join(" | ")}
                           (auto-detected from the request + existing code if omitted)
  -t, --target <dir>       Project directory (default: cwd; created if missing)
  -p, --preset <name>      ${PRESET_NAMES.join(" | ")} (default: balanced)
      --model-<lane> <id>  Override one lane's model. Lanes: ${LANES.join(", ")}
      --model <id>         Single model for ALL lanes (only with --preset solo)
      --threshold <n>      Quality gate, 1-100 (default: 98)
  -c, --concurrency <n>    Max parallel agents per wave (default: 3)
      --fast               Skip E2E + visual-QA (quick pass)
      --no-git             Single-branch mode, no git orchestration
  -y, --yes                Non-interactive: auto-approve all tool use
  -h, --help

MODEL LANES (independent models → independent blind spots)
  The model that BUILDS is never the one that reviews/tests/judges it.
    scope   → discovery            design → designer
    build   → frontend, backend, devops, docs, performance, bugfix
    review  → security, code-review    verify → qa, e2e
    visual  → visual-qa            gate   → conductor

  Presets:
    balanced  build=Opus, everything that judges/designs/verifies=Sonnet (default)
    diverse   spread across families (design=Opus, build=Sonnet, review=GLM-5,
              verify=Haiku, visual=Opus) — run \`webdev models --probe\` first
    solo      all lanes inherit one model (use when your proxy serves only one)

  Persist a custom map in ~/.claude/webdev-models.json:
    { "build": "claude-opus-4-8", "review": "glm-5", "verify": "claude-haiku-4-5" }

MODES
  greenfield · iteration · bugfix · refactor · ui-polish · migration · audit

EXAMPLES
  webdev "build a markdown note app with tags and search"
  webdev "add dark mode and CSV export" -m iteration -p diverse
  webdev "build a SaaS dashboard" --model-review glm-5 --model-verify claude-haiku-4-5
  webdev models --probe
`);
}

const die = (msg: string): never => { console.error(`error: ${msg}`); process.exit(1); };
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : lo));
const shortErr = (e: unknown) => String((e as any)?.message ?? e).split("\n")[0].slice(0, 60);

main().catch((err) => { console.error(err); process.exit(1); });
