// Mode → phase plan. The orchestrator is one deterministic engine; the mode
// only decides which phases run and how heavy each is. This is what lets the
// same workflow serve greenfield, iteration, bugfix, refactor, ui-polish,
// migration, and audit.

import type { Mode, AgentName } from "./types.ts";

export interface PhasePlan {
  /** Run the discovery agent to (re)scope. Bugfix/ui-polish can skip heavy scoping. */
  scope: boolean;
  /** Run the per-feature build waves (designer/frontend/backend/etc.). */
  featureBuild: boolean;
  /** Review-wave agents to run in parallel on develop. */
  reviewWave: AgentName[];
  /** Runtime verification (start app, hit endpoints). */
  runtime: boolean;
  /** E2E browser tests + screenshot capture. */
  e2e: boolean;
  /** Visual-QA screenshot analysis (blocking on slop). */
  visualQa: boolean;
  /** Conductor quality gate. */
  conductor: boolean;
  /** Iteration mode must protect existing behavior. */
  regressionCheck: boolean;
  /** Audit mode produces reports only — no code changes, no merge to main. */
  analysisOnly: boolean;
  /** One-line description shown to the user. */
  summary: string;
}

const FULL_REVIEW: AgentName[] = ["qa", "security", "code-review", "performance"];

export function planFor(mode: Mode, fast: boolean): PhasePlan {
  const base = (p: Partial<PhasePlan>): PhasePlan => ({
    scope: true,
    featureBuild: true,
    reviewWave: FULL_REVIEW,
    runtime: true,
    e2e: !fast,
    visualQa: !fast,
    conductor: true,
    regressionCheck: false,
    analysisOnly: false,
    summary: "",
    ...p,
  });

  switch (mode) {
    case "greenfield":
      return base({ summary: "New build from scratch → full pipeline → tagged release." });

    case "iteration":
      return base({
        reviewWave: ["qa", "security"], // lighter review for additions
        regressionCheck: true,
        summary: "Add features to an existing app, guarding against regressions → point release.",
      });

    case "bugfix":
      return base({
        scope: false,
        featureBuild: false,
        reviewWave: ["qa"],
        e2e: !fast,
        visualQa: false,
        regressionCheck: true,
        summary: "Diagnose and fix a specific defect via the bugfix protocol → verify → release.",
      });

    case "refactor":
      return base({
        reviewWave: ["qa", "code-review", "performance"],
        e2e: !fast,
        visualQa: false,
        regressionCheck: true,
        summary: "Restructure code while proving behavior is unchanged.",
      });

    case "ui-polish":
      return base({
        reviewWave: ["code-review"],
        runtime: true,
        e2e: !fast,
        visualQa: true, // the whole point
        summary: "Visual cleanup: re-run the design suite, fix CSS/layout, pass visual-QA.",
      });

    case "migration":
      return base({
        reviewWave: ["qa", "security", "code-review"],
        visualQa: false,
        regressionCheck: true,
        summary: "Upgrade dependencies/framework incrementally, testing each step.",
      });

    case "audit":
      return base({
        featureBuild: false,
        reviewWave: FULL_REVIEW,
        runtime: false,
        e2e: false,
        visualQa: !fast,
        conductor: true,
        analysisOnly: true,
        summary: "Analysis only — run reviewers, produce a report, change nothing.",
      });
  }
}

/** Heuristic mode detection from the request when --mode is not given. */
export function detectMode(request: string, hasExistingCode: boolean): Mode {
  const r = request.toLowerCase();
  if (/\b(audit|review|analy[sz]e|assess|inspect)\b/.test(r) && !/\bfix\b/.test(r)) return "audit";
  if (/\b(bug|broken|not working|doesn't work|crash|error|fails?|regression)\b/.test(r)) return "bugfix";
  if (/\b(refactor|clean up|restructure|split|extract|tidy)\b/.test(r)) return "refactor";
  if (/\b(polish|prettier|restyle|redesign|css|design pass|premium|generic|beautiful)\b/.test(r)) return "ui-polish";
  if (/\bmake\b.*\b(look|prettier|nicer|better|beautiful|premium|modern|clean)\b/.test(r)) return "ui-polish";
  if (/\blook(s)?\b.*\b(better|nicer|premium|professional|modern|good|great)\b/.test(r)) return "ui-polish";
  if (/\b(migrat|upgrade|move from|port to|bump)\b/.test(r)) return "migration";
  if (hasExistingCode && /\b(add|implement|extend|also|new feature|support for)\b/.test(r)) return "iteration";
  return hasExistingCode ? "iteration" : "greenfield";
}
