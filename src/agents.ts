// Agent definitions — the 14 real subagents the orchestrator spawns.
//
// Each maps to a system prompt in ./prompts/*.md and gets a scoped toolset so a
// subagent can only do its job (read-only reviewers can't edit; the visual-qa
// agent can only read; etc.). Design-facing agents preload the claudekit design
// suite so the anti-slop intelligence is in-context, not improvised.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { AgentDefinition } from "@anthropic-ai/claude-agent-sdk";
import type { AgentName, RunConfig } from "./types.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Shared terse directive appended to every agent's system prompt. Cuts prose
// output tokens ("why use many token when few do trick") WITHOUT touching the
// machine-parsed handoffs the orchestration depends on. The carve-outs are
// non-negotiable: they name every artifact that must stay byte-exact.
const TERSE_DIRECTIVE = `

---
## Output economy (token discipline)
Be terse in prose. Prefer fragments over full sentences; drop filler, hedging,
preamble, and restated context. Say what matters, then stop. This reduces cost
and latency for the user — it does NOT mean reason less; think as hard as
needed, just say it with fewer words. Preserve the user's language.

**Keep the following FULLY INTACT and byte-exact — never compress, abbreviate,
telegraph, or reword these:**
- All code, config, and file contents you write or edit.
- Every \`.workflow/\` artifact: \`scope.yaml\`, \`semantic-registry.yaml\`,
  \`api-contracts.yaml\`, \`state.yaml\`, design tokens, and reports whose format
  is consumed downstream.
- The conductor's final \`\`\`yaml scoring block (the orchestrator parses it verbatim).
- Class/token/endpoint names, file paths, commands, URLs, and error strings.
- Commit messages (follow the CLAUDE.md convention exactly).
Terseness applies to your explanatory prose ONLY, never to structured output or
anything another agent or the orchestrator reads.`;

function prompt(name: AgentName): string {
  return readFileSync(join(__dirname, "prompts", `${name}.md`), "utf8") + TERSE_DIRECTIVE;
}

// Common toolsets.
const READ_ONLY = ["Read", "Glob", "Grep"];
const WRITE_CODE = ["Read", "Write", "Edit", "Glob", "Grep"];
const FULL_BUILD = ["Bash", "Read", "Write", "Edit", "Glob", "Grep"];

/**
 * Build the agent registry for a run. Each agent gets its LANE's model (see
 * models.ts) so the model that builds is never the one that reviews/tests/
 * judges it. Lanes are resolved in the CLI and carried on RunConfig.
 */
export function buildAgents(config: RunConfig): Record<AgentName, AgentDefinition> {
  const m = config.laneModels;
  const scope = m.scope, design = m.design, build = m.build,
        review = m.review, verify = m.verify, visual = m.visual, gate = m.gate;

  return {
    discovery: {
      description:
        "Requirements analyst. Reads the request (and existing code) and writes .workflow/scope.yaml. Runs first.",
      prompt: prompt("discovery"),
      tools: [...READ_ONLY, "Write", "AskUserQuestion"],
      model: scope,
    },

    designer: {
      description:
        "Design-system author. Runs the design suite to pick style/palette/fonts, then publishes tokens + semantic registry. Runs before frontend on a feature branch.",
      prompt: prompt("designer"),
      tools: FULL_BUILD,
      // The anti-slop intelligence lives in these skills — preload it.
      skills: ["ui-ux-pro-max", "design-system", "brand"],
      model: design,
    },

    frontend: {
      description:
        "UI engineer. Implements the design exactly, using only the published registry + tokens. Adds data-testid. Renders real data.",
      prompt: prompt("frontend"),
      tools: FULL_BUILD,
      skills: ["ui-styling", "design-system"],
      model: build,
    },

    backend: {
      description:
        "API/data engineer. Builds endpoints, data model, business logic, and publishes .workflow/api-contracts.yaml.",
      prompt: prompt("backend"),
      tools: FULL_BUILD,
      model: build,
    },

    docs: {
      description:
        "Documentation engineer. Writes README, CLAUDE.md, and API docs grounded in the real code and contracts.",
      prompt: prompt("docs"),
      tools: WRITE_CODE,
      model: build,
    },

    devops: {
      description:
        "DevOps engineer. Dockerfile, compose, CI pipeline, .env.example. Pins versions, no secrets.",
      prompt: prompt("devops"),
      tools: FULL_BUILD,
      model: build,
    },

    qa: {
      description:
        "QA engineer. Sets up the test framework, writes and RUNS unit + integration tests, guards against regressions.",
      prompt: prompt("qa"),
      tools: FULL_BUILD,
      model: verify,
    },

    security: {
      description:
        "Security reviewer. Finds vulnerabilities (injection, authz, secrets, XSS/CSRF, deps) with severity + fix. Read-mostly.",
      prompt: prompt("security"),
      tools: ["Bash", "Read", "Grep", "Glob", "Edit"],
      model: review,
      effort: "high",
    },

    "code-review": {
      description:
        "Code reviewer. Correctness, reuse, simplification, consistency. Applies safe fixes; flags behavior-changing ones.",
      prompt: prompt("code-review"),
      tools: ["Read", "Edit", "Grep", "Glob"],
      model: review,
    },

    performance: {
      description:
        "Performance engineer. Finds measured bottlenecks (N+1, indexes, bundles, images, CWV) and applies safe optimizations.",
      prompt: prompt("performance"),
      tools: ["Bash", "Read", "Edit", "Grep", "Glob"],
      model: build,
    },

    e2e: {
      description:
        "E2E engineer. Drives the running app in Playwright, tests real user flows, captures multi-viewport screenshots.",
      prompt: prompt("e2e"),
      tools: FULL_BUILD,
      model: verify,
    },

    "visual-qa": {
      description:
        "Visual reviewer. Reads rendered screenshots and scores them against the design system + slop fingerprint. Read-only.",
      prompt: prompt("visual-qa"),
      tools: ["Read", "Glob"],
      skills: ["ui-ux-pro-max"],
      model: visual,
      effort: "high",
    },

    bugfix: {
      description:
        "Bugfix specialist. Reproduce → trace → isolate root cause → minimal fix → verify. One root cause per branch.",
      prompt: prompt("bugfix"),
      tools: FULL_BUILD,
      model: build,
    },

    conductor: {
      description:
        "Quality gate. Scores the build on a 100-point rubric and decides pass/iterate with targeted fixes. Read-only.",
      prompt: prompt("conductor"),
      tools: READ_ONLY,
      model: gate,
      effort: "high",
    },

    explain: {
      description:
        "Read-only code explainer. Answers how a feature/file/flow works, grounded in the real code. Changes nothing.",
      prompt: prompt("explain"),
      tools: READ_ONLY,
      model: review,
    },
  };
}

/** Tool list the orchestrator (main query) must allow so it can spawn agents. */
export const ALL_AGENT_NAMES: AgentName[] = [
  "discovery", "designer", "frontend", "backend", "docs", "devops",
  "qa", "security", "code-review", "performance", "e2e", "visual-qa",
  "bugfix", "conductor", "explain",
];
