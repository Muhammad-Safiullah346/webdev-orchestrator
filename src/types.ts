// Shared types for the webdev orchestrator.

export type Mode =
  | "greenfield"
  | "iteration"
  | "bugfix"
  | "refactor"
  | "ui-polish"
  | "migration"
  | "audit";

export type AgentName =
  | "discovery"
  | "designer"
  | "frontend"
  | "backend"
  | "docs"
  | "devops"
  | "qa"
  | "security"
  | "code-review"
  | "performance"
  | "e2e"
  | "visual-qa"
  | "bugfix"
  | "conductor";

export interface Feature {
  name: string;
  description: string;
  agents: AgentName[];
  branch: string;
  dependencies: string[];
  /** Files this feature is expected to touch (iteration mode). */
  touches?: string[];
}

export interface Scope {
  project: {
    name: string;
    type: Mode;
    /** e.g. "1.0.0" or "1.0.0 -> 1.1.0" */
    version?: string;
    stack?: string;
    summary?: string;
  };
  features: Feature[];
  review_wave: { agents: AgentName[] };
  /** External third-party secrets the app needs (names only — values are
   *  collected by the harness, never by an agent). e.g. STRIPE_SECRET_KEY. */
  external_secrets?: { name: string; purpose?: string }[];
  /** Free-form notes the PM should respect across phases. */
  notes?: string[];
}

export interface ConductorScore {
  score: number; // 0-100
  breakdown: Record<string, number>;
  blocking_issues: { dimension: string; issue: string; severity: string }[];
  decision: "pass" | "iterate";
  fixes_needed?: { branch: string; agent: AgentName; issue: string }[];
}

export interface RunConfig {
  request: string;
  mode: Mode;
  target: string; // absolute path to the project working dir
  /** Per-lane model assignment (build ≠ review ≠ verify ≠ design ≠ gate). */
  laneModels: import("./models.ts").LaneModels;
  /** The preset name the lane models were resolved from (for logging). */
  preset: import("./models.ts").PresetName;
  /** Quality gate threshold, 0-100. */
  threshold: number;
  /** Skip git branch orchestration (single-branch mode). */
  noGit: boolean;
  /** Skip the heavy E2E + visual-QA phases (fast mode). */
  fast: boolean;
  /** Auto-approve everything (non-interactive). */
  yes: boolean;
  /** Max parallel subagents in a feature wave. */
  concurrency: number;
}

export interface PhaseResult {
  phase: string;
  ok: boolean;
  detail?: string;
}
