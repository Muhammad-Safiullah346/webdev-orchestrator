// Seeds the target project's .claude/ with the harness hooks, settings, and
// CLAUDE.md so the secret-guard / design-lint hooks actually fire during a
// build (subagents run with cwd = target and settingSources ["user","project"],
// so they load the TARGET's .claude, not the harness's).

import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HARNESS_CLAUDE = resolve(__dirname, "..", ".claude");

export function seedTargetClaude(target: string): void {
  const srcHooks = join(HARNESS_CLAUDE, "hooks");
  const destClaude = join(target, ".claude");
  const destHooks = join(destClaude, "hooks");
  mkdirSync(destHooks, { recursive: true });

  // Copy hook scripts (always refresh — they're harness-owned).
  if (existsSync(srcHooks)) cpSync(srcHooks, destHooks, { recursive: true });

  // Seed settings.json only if the target doesn't already have one, so we don't
  // clobber a user's existing project settings. Merge our hooks in if it exists.
  const destSettings = join(destClaude, "settings.json");
  const harnessSettings = JSON.parse(readFileSync(join(HARNESS_CLAUDE, "settings.json"), "utf8"));
  if (!existsSync(destSettings)) {
    writeFileSync(destSettings, JSON.stringify(harnessSettings, null, 2), "utf8");
  } else {
    try {
      const existing = JSON.parse(readFileSync(destSettings, "utf8"));
      existing.hooks = harnessSettings.hooks; // ensure our gates are wired
      existing.permissions = mergePermissions(existing.permissions, harnessSettings.permissions);
      writeFileSync(destSettings, JSON.stringify(existing, null, 2), "utf8");
    } catch {
      writeFileSync(destSettings, JSON.stringify(harnessSettings, null, 2), "utf8");
    }
  }

  // Seed a CLAUDE.md only if absent (don't overwrite a project's own).
  const destClaudeMd = join(destClaude, "CLAUDE.md");
  if (!existsSync(destClaudeMd)) {
    cpSync(join(HARNESS_CLAUDE, "CLAUDE.md"), destClaudeMd);
  }
}

function mergePermissions(a: any, b: any): any {
  const out = { allow: [], deny: [], ...(a ?? {}) };
  const uniq = (xs: string[]) => Array.from(new Set(xs));
  out.allow = uniq([...(a?.allow ?? []), ...(b?.allow ?? [])]);
  out.deny = uniq([...(a?.deny ?? []), ...(b?.deny ?? [])]);
  return out;
}
