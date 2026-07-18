// Environment provisioning — turns a declared set of env vars into a working
// .env so the app can actually run during runtime/E2E verification.
//
// Three classes of variable, handled differently by WHO can produce the value:
//   - "generated": any value works locally (JWT_SECRET, SESSION_SECRET, PORT,
//                  BASE_URL, NODE_ENV). Deterministic code generates them.
//   - "infra":     local services + fixtures the harness can stand up itself
//                  (DATABASE_URL → sqlite file or local docker postgres; seeded
//                  TEST_USER_* credentials).
//   - "external":  real third-party secrets only the user can supply (STRIPE_*,
//                  OPENAI_API_KEY, SMTP_PASSWORD, *_CLIENT_SECRET). Collected
//                  once, interactively, by code — never by an agent, so the raw
//                  value never enters an LLM context or transcript.

import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";

export type EnvClass = "generated" | "infra" | "external";

export interface EnvVar {
  name: string;
  class: EnvClass;
  purpose?: string;
}

// ── .env file read/merge (never overwrites an existing key → idempotent) ─────

export function parseEnv(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !line.trim().startsWith("#")) out[m[1]] = stripQuotes(m[2]);
  }
  return out;
}

/** Merge keys into .env, only adding keys that aren't already present. */
export function mergeEnv(target: string, kv: Record<string, string>): string[] {
  const path = join(target, ".env");
  const existing = parseEnv(path);
  const added: string[] = [];
  const lines: string[] = [];
  for (const [k, v] of Object.entries(kv)) {
    if (existing[k] === undefined && v !== undefined && v !== "") {
      lines.push(`${k}=${needsQuote(v) ? JSON.stringify(v) : v}`);
      added.push(k);
    }
  }
  if (lines.length) {
    const prefix = existsSync(path) && readFileSync(path, "utf8").length && !readFileSync(path, "utf8").endsWith("\n") ? "\n" : "";
    appendFileSync(path, prefix + lines.join("\n") + "\n", "utf8");
  } else if (!existsSync(path)) {
    writeFileSync(path, "", "utf8");
  }
  return added;
}

/** Parse the KEY names out of a .env.example (values ignored — they're samples). */
export function exampleKeys(target: string): string[] {
  return Object.keys(exampleEnv(target));
}

/** Parse the full key→value map from a .env.example. The VALUES matter: the
 *  devops/backend agent writes a working local connection string as the value
 *  (DATABASE_URL=postgres://…, MONGODB_URI=mongodb://localhost…, REDIS_URL=…).
 *  Honoring that value is what makes provisioning work for ANY database without
 *  the harness enumerating database types. */
export function exampleEnv(target: string): Record<string, string> {
  for (const name of [".env.example", ".env.sample", ".env.template"]) {
    const p = join(target, name);
    if (existsSync(p)) return parseEnv(p);
  }
  return {};
}

// ── value generation for the "generated" class ──────────────────────────────

export function generateValue(name: string): string {
  const n = name.toUpperCase();
  if (/(SECRET|KEY|TOKEN|SALT|PASSWORD|JWT)/.test(n) && !/PUBLIC/.test(n)) {
    return randomBytes(32).toString("hex");
  }
  if (n === "PORT") return "3000";
  if (n.includes("BASE_URL") || n.includes("APP_URL") || n.includes("PUBLIC_URL")) return "http://localhost:3000";
  if (n === "NODE_ENV") return "development";
  if (n === "HOST") return "localhost";
  return randomBytes(16).toString("hex");
}

/** Heuristic: is this var name an external third-party secret? */
export function looksExternal(name: string): boolean {
  return /(STRIPE|OPENAI|ANTHROPIC|SENDGRID|TWILIO|AWS_|S3_|^R2_|GITHUB_|GOOGLE_|OAUTH|CLIENT_SECRET|SMTP_PASS|MAILGUN|PAYPAL|FIREBASE|SUPABASE_SERVICE|_ACCESS_KEY_ID|_SECRET_ACCESS_KEY)/i.test(name);
}

/** Is this a locally-generatable secret (JWT/session/salt/etc.)? Such vars must
 *  be freshly randomized — never copied from an example placeholder like
 *  "changeme". Distinct from `looksExternal` (user-supplied) and from plain
 *  config/URLs (whose declared example value we honor verbatim). */
export function isGeneratableSecret(name: string): boolean {
  if (looksExternal(name)) return false;
  const n = name.toUpperCase();
  if (/PUBLIC/.test(n)) return false; // public keys/URLs aren't secrets
  return /(SECRET|JWT|SALT|SESSION|ENCRYPT|COOKIE|PRIVATE_KEY|_TOKEN$|^TOKEN$|PASSWORD)/.test(n);
}

/** Zero-service fallback DB when the app declares no database of its own. */
export function fallbackSqliteUrl(dbName: string): string {
  return `file:./${dbName || "app"}.db`;
}

/** Does this var name look like a database/backing-store connection string?
 *  Used only to decide whether the no-example fallback should seed one. */
export function isDbUrlName(name: string): boolean {
  return /^(DATABASE_URL|DB_URL|POSTGRES_URL|MYSQL_URL|MONGO(DB)?_URI?|MONGO_URL|REDIS_URL|DATABASE_URI|DB_CONNECTION|CONNECTION_STRING|NEO4J_URI|CASSANDRA_|SQLITE_)/i.test(name);
}

/** Does the app declare object storage (S3/R2/B2 for images, PDFs, video…)?
 *  Detected purely from the declared env-var names — no app-code inspection.
 *  The provision phase uses this to force a LOCAL storage driver for testing so
 *  verification never touches (or bills) the user's real bucket — the storage
 *  analogue of `isRemoteDbUrl` + `localizeDbUrl`. */
export function usesObjectStorage(keys: string[]): boolean {
  return keys.some((k) => /^STORAGE_|^R2_|_BUCKET$/i.test(k));
}

/** Does this connection string point at a REMOTE / managed datastore (Atlas,
 *  Neon, PlanetScale, Upstash, a LAN/cloud host…) rather than a local one?
 *  Testing must never run against a remote DB — it's destructive (migrations +
 *  seed). Local forms (`localhost`, `127.0.0.1`, a bare docker-compose service
 *  name, or a `file:`/SQLite path) are safe; anything else is treated as remote. */
export function isRemoteDbUrl(value: string): boolean {
  if (!value) return false;
  const v = value.trim();
  if (/^file:|^sqlite/i.test(v)) return false;             // file-based → never remote
  if (/\+srv:\/\//i.test(v)) return true;                  // mongodb+srv → managed cluster
  const host = (v.match(/^[a-z0-9+.\-]+:\/\/(?:[^@/]*@)?([^:/?#]+)/i)?.[1] ?? "").toLowerCase();
  if (!host) return false;
  if (["localhost", "127.0.0.1", "0.0.0.0", "::1", "host.docker.internal"].includes(host)) return false;
  // A fully-qualified domain or IP (contains a dot) that isn't localhost → remote.
  // A bare single-label host (e.g. compose service "db"/"mongo") is local-ish.
  return host.includes(".");
}

/** Rewrite a remote DB connection string to an equivalent LOCAL one — same
 *  scheme and database name, host forced to localhost with the scheme's default
 *  port, credentials/SRV dropped — so a Mongo/Postgres/etc. app still boots and
 *  tests locally without ever touching the user's managed database. */
export function localizeDbUrl(value: string, dbName: string): string {
  const v = value.trim();
  const scheme = (v.match(/^([a-z0-9+.\-]+):\/\//i)?.[1] ?? "").toLowerCase().replace("+srv", "");
  const defaultPort: Record<string, number> = {
    mongodb: 27017, postgres: 5432, postgresql: 5432, mysql: 3306,
    mariadb: 3306, redis: 6379, neo4j: 7687, "bolt": 7687,
  };
  const path = v.match(/^[a-z0-9+.\-]+:\/\/(?:[^@/]*@)?[^/?#]+(\/[^?#]*)?/i)?.[1] ?? `/${dbName || "app"}`;
  const port = defaultPort[scheme];
  if (!scheme) return fallbackSqliteUrl(dbName);           // unparseable → safe SQLite fallback
  return `${scheme}://localhost${port ? `:${port}` : ""}${path || `/${dbName || "app"}`}`;
}

// ── masked interactive prompt for the "external" class ───────────────────────

export function isInteractive(nonInteractive: boolean): boolean {
  return !nonInteractive && Boolean(process.stdin.isTTY);
}

/**
 * Prompt once for each external secret with masked input. Returns the collected
 * values (only those the user actually entered). "" / "mock" / "skip" → omitted
 * (the app will use a test mock for that integration).
 */
export async function promptForSecrets(vars: EnvVar[]): Promise<Record<string, string>> {
  const collected: Record<string, string> = {};
  if (!vars.length) return collected;

  process.stdout.write(
    "\n🔑 This build needs some external service secrets. Paste a value, or press Enter to mock it in tests.\n" +
    "   (Values are written straight to .env by the harness — they never enter any agent's context.)\n\n",
  );

  for (const v of vars) {
    const value = await maskedQuestion(`   ${v.name}${v.purpose ? ` (${v.purpose})` : ""}: `);
    const trimmed = value.trim();
    if (trimmed && !/^(mock|skip|x)$/i.test(trimmed)) collected[v.name] = trimmed;
  }
  process.stdout.write("\n");
  return collected;
}

function maskedQuestion(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    // Mute echo: replace what's written after the prompt with nothing.
    let muted = false;
    const realWrite = (rl as any)._writeToOutput?.bind(rl);
    (rl as any)._writeToOutput = (s: string) => {
      if (!muted || s.includes(prompt)) realWrite?.(s);
      // while muted, swallow the echoed characters
    };
    rl.question(prompt, (answer) => {
      muted = false;
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
    muted = true;
  });
}

// ── helpers ──────────────────────────────────────────────────────────────────

function stripQuotes(v: string): string {
  const t = v.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    try { return JSON.parse(t); } catch { return t.slice(1, -1); }
  }
  return t;
}

function needsQuote(v: string): boolean {
  return /\s|#|"|'/.test(v);
}
