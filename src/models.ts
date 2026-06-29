// Model lanes — assign a DISTINCT model to each role so the model that builds
// is never the one that reviews, tests, or judges it. Independent models have
// independent blind spots: an author's model rationalizes its own mistakes; a
// different model catches them. Same logic separates designer from implementer.
//
// IMPORTANT: the exact model-ID strings depend on what your proxy accepts.
// With ANTHROPIC_BASE_URL set, the SDK speaks the Anthropic API dialect, so the
// defaults below use Anthropic IDs. Override per-lane via CLI/config, and use
// `webdev models --probe` to confirm which IDs your proxy answers to.

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { AgentName } from "./types.ts";

export type Lane = "scope" | "design" | "build" | "review" | "verify" | "visual" | "gate";

export type LaneModels = Record<Lane, string>;

// Which lane each agent belongs to.
export const AGENT_LANE: Record<AgentName, Lane> = {
  discovery: "scope",
  designer: "design",
  frontend: "build",
  backend: "build",
  docs: "build",
  devops: "build",
  performance: "build",
  bugfix: "build",
  security: "review",
  "code-review": "review",
  qa: "verify",
  e2e: "verify",
  "visual-qa": "visual",
  conductor: "gate",
};

// Anthropic-dialect IDs (most likely what a proxy fronting the Anthropic API
// accepts). Kiro Enterprise also exposes these models.
const ID = {
  OPUS: "claude-opus-4-8",
  OPUS_47: "claude-opus-4-7",
  SONNET: "claude-sonnet-4-6",
  SONNET_45: "claude-sonnet-4-5",
  HAIKU: "claude-haiku-4-5",
  // Cross-family (Kiro selector names; your proxy may use different strings).
  GLM5: "glm-5",
  DEEPSEEK: "deepseek-3.2",
  QWEN: "qwen3-coder-next",
} as const;

export type PresetName = "balanced" | "diverse" | "solo";

/**
 * balanced — only Opus + Sonnet (the IDs most likely supported). Build is the
 *   product → Opus; every judging/design/verify lane → Sonnet, so author (Opus)
 *   ≠ reviewer/tester/designer (Sonnet) everywhere. Reliable, lower cost than
 *   all-Opus.
 * diverse — spreads across families for maximum blind-spot coverage. Opt-in:
 *   leans on cross-family IDs you should `--probe` first. Conductor stays on a
 *   Claude model for reliable structured-output gating.
 * solo — everything inherits the session/proxy default model (no diversity).
 *   Use when your proxy serves a single model.
 */
export const PRESETS: Record<PresetName, LaneModels> = {
  balanced: {
    scope: ID.SONNET,
    design: ID.SONNET,
    build: ID.OPUS,
    review: ID.SONNET,
    verify: ID.SONNET,
    visual: ID.SONNET,
    gate: ID.SONNET,
  },
  diverse: {
    scope: ID.SONNET_45,
    design: ID.OPUS,      // best design reasoning / taste
    build: ID.SONNET,     // strong implementer, ≠ designer
    review: ID.GLM5,      // cross-family reviewer, ≠ builder
    verify: ID.HAIKU,     // independent, cheap test author, ≠ builder
    visual: ID.OPUS,      // vision quality, ≠ builder
    gate: ID.OPUS,        // reliable structured-output judge
  },
  solo: {
    scope: "inherit", design: "inherit", build: "inherit", review: "inherit",
    verify: "inherit", visual: "inherit", gate: "inherit",
  },
};

const LANES: Lane[] = ["scope", "design", "build", "review", "verify", "visual", "gate"];
const CONFIG_PATH = join(homedir(), ".claude", "webdev-models.json");

/**
 * Resolve the final lane→model map. Precedence (low→high):
 *   preset defaults → ~/.claude/webdev-models.json → explicit per-lane overrides.
 * A global `model` (legacy --model) seeds any lane left unset, EXCEPT it must
 * not collapse build into review/verify/design (that would defeat independence)
 * — so a single --model only applies when the preset is "solo".
 */
export function resolveLaneModels(opts: {
  preset?: PresetName;
  overrides?: Partial<LaneModels>;
  globalModel?: string;
}): { models: LaneModels; preset: PresetName; warnings: string[] } {
  const warnings: string[] = [];
  const preset = opts.preset ?? "balanced";
  const base: LaneModels = { ...PRESETS[preset] };

  // Config file overrides.
  const fileCfg = readConfigFile();
  for (const lane of LANES) if (fileCfg[lane]) base[lane] = fileCfg[lane]!;

  // Explicit per-lane overrides (highest precedence).
  if (opts.overrides) for (const lane of LANES) {
    const v = opts.overrides[lane];
    if (v) base[lane] = v;
  }

  // A legacy single --model only collapses everything when preset is solo.
  if (opts.globalModel && opts.globalModel !== "inherit") {
    if (preset === "solo") for (const lane of LANES) base[lane] = opts.globalModel;
    else warnings.push(
      `--model "${opts.globalModel}" ignored: preset "${preset}" assigns models per lane. ` +
      `Use --preset solo to force one model, or --model-<lane> to override a specific lane.`,
    );
  }

  // Independence check: warn if a judging lane equals the build model.
  if (preset !== "solo") {
    for (const lane of ["review", "verify", "visual"] as Lane[]) {
      if (base[lane] === base.build && base.build !== "inherit") {
        warnings.push(`Lane "${lane}" uses the same model as "build" (${base.build}) — review/verify won't be independent.`);
      }
    }
    if (base.design === base.build && base.build !== "inherit") {
      warnings.push(`"design" and "build" share a model (${base.build}) — designer won't be independent of the implementer.`);
    }
  }

  return { models: base, preset, warnings };
}

export function modelForAgent(models: LaneModels, agent: AgentName): string {
  return models[AGENT_LANE[agent]] ?? "inherit";
}

function readConfigFile(): Partial<LaneModels> {
  if (!existsSync(CONFIG_PATH)) return {};
  try { return JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as Partial<LaneModels>; }
  catch { return {}; }
}

export function laneSummary(models: LaneModels): string {
  return LANES.map((l) => `  ${l.padEnd(7)} → ${models[l]}`).join("\n");
}

export { ID as MODEL_IDS, CONFIG_PATH, LANES };
