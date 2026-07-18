// Shared types for the webdev orchestrator.

export type Mode =
  | "greenfield"
  | "iteration"
  | "bugfix"
  | "refactor"
  | "ui-polish"
  | "migration"
  | "audit"
  | "explain";

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
  | "conductor"
  | "explain";

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

/** One deployable component in the machine-readable deploy recipe the devops
 *  agent writes to `.workflow/deploy-plan.yaml`. The agent PLANS (picks the
 *  platform + CLI + ordered steps); deterministic code EXECUTES it, injecting
 *  collected credentials into the child process. Secret VALUES never appear
 *  here — only their names, so code knows what to prompt for (masked). */
export interface DeployComponent {
  /** Logical piece, e.g. "database" | "backend" | "frontend" | "storage". */
  name: string;
  /** Human label for the chosen platform, e.g. "neon", "fly", "cloudflare-pages". */
  platform: string;
  /** The CLI code must find installed before running this component's steps. */
  cli: { tool: string; version_arg?: string };
  /** Other component names that must deploy first (ordering + output wiring). */
  needs?: string[];
  /** Credential names to collect (masked) and inject into this step's env. */
  secrets?: string[];
  /** Env-var names (from collected secrets or prior components' `provides`)
   *  to inject into the child process for this component's steps. */
  env?: string[];
  /** Env-var names this component emits (parsed from step stdout) for dependents. */
  provides?: string[];
  /** Ordered shell steps. `${VAR}` placeholders are resolved (via shellQuote)
   *  from collected secrets + resolved `provides` before execution. */
  steps: string[];
}

/** The deploy recipe: components + the union of credential names to prompt for. */
export interface DeployPlan {
  components: DeployComponent[];
  /** Every credential the plan needs (name + purpose only — never a value). */
  prompt_secrets?: { name: string; purpose?: string }[];
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
  /** Skip the deploy phase (no deploy config / DEPLOY.md / CD workflow). */
  noDeploy: boolean;
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
