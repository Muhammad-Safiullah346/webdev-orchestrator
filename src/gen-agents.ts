// Generates .claude/agents/*.md (filesystem subagents) from the same prompts +
// metadata the SDK uses, so the agents are available when you open the harness
// (or a seeded project) directly in Claude Code — in-IDE parity with the CLI.
//
//   npx tsx src/gen-agents.ts
//
// Run this after editing any prompt or agent toolset.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { buildAgents, ALL_AGENT_NAMES } from "./agents.ts";
import { PRESETS } from "./models.ts";
import type { RunConfig } from "./types.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTS_DIR = resolve(__dirname, "..", ".claude", "agents");

// Minimal config to materialize the definitions. The filesystem mirror is for
// in-IDE use, where the session model applies — so keep lanes model-agnostic
// ("solo" → all inherit) and don't pin possibly-unsupported IDs into frontmatter.
const cfg = {
  request: "", mode: "greenfield", target: process.cwd(),
  laneModels: PRESETS.solo, preset: "solo", threshold: 98,
  noGit: false, fast: false, yes: false, concurrency: 3,
} as RunConfig;

const defs = buildAgents(cfg);
mkdirSync(AGENTS_DIR, { recursive: true });

for (const name of ALL_AGENT_NAMES) {
  const def = defs[name];
  const fm: string[] = [
    "---",
    `name: ${name}`,
    `description: ${JSON.stringify(def.description)}`,
  ];
  if (def.tools) fm.push(`tools: ${def.tools.join(", ")}`);
  if (def.model && def.model !== "inherit") fm.push(`model: ${def.model}`);
  if ((def as any).skills) fm.push(`skills: ${(def as any).skills.join(", ")}`);
  fm.push("---", "");
  const body = readFileSync(join(__dirname, "prompts", `${name}.md`), "utf8");
  writeFileSync(join(AGENTS_DIR, `${name}.md`), fm.join("\n") + body, "utf8");
  console.log(`  ✓ .claude/agents/${name}.md`);
}
console.log(`\nGenerated ${ALL_AGENT_NAMES.length} filesystem agents in ${AGENTS_DIR}`);
