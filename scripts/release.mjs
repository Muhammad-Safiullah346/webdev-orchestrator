#!/usr/bin/env node
// One-command release: guard → bump (local) → publish → push.
//
//   npm run release          # patch  (1.1.1 → 1.1.2)
//   npm run release:minor    # minor  (1.1.1 → 1.2.0)
//   npm run release:major    # major  (1.1.1 → 2.0.0)
//
// ORDER MATTERS. We PUBLISH to npm before pushing the tag to GitHub, and roll
// back the local version bump if publish fails. This guarantees GitHub and npm
// never desync: a failed or unauthorized publish leaves the repo exactly as it
// was, instead of stranding a pushed tag ahead of the registry.
//
// `npm version` fires the preversion hook (typecheck) and commits + tags
// LOCALLY only — the postversion auto-push hook was intentionally removed from
// package.json so the push happens here, AFTER a successful publish.

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const bump = process.argv[2] ?? "patch";
const sh = (cmd) => execSync(cmd, { stdio: "inherit" });
const cap = (cmd) => execSync(cmd, { encoding: "utf8" }).trim();
const die = (msg) => { console.error(`\n✗ ${msg}\n`); process.exit(1); };

// 1. Is the configured npm token one the registry actually accepts?
//    (whoami catches an expired/invalid token BEFORE we mutate anything —
//    the failure mode that stranded a pushed tag in the past.)
let npmUser;
try { npmUser = cap("npm whoami 2>/dev/null"); }
catch {
  die(
    "npm auth failed (`npm whoami`). Set a valid token first:\n" +
    "  npm config set //registry.npmjs.org/:_authToken <token>\n" +
    "Use a granular/automation token with 'Bypass 2FA' + read/write on the package.",
  );
}
console.log(`npm user:  ${npmUser}`);

// 2. Clean working tree, so the rollback below is safe and unambiguous.
if (cap("git status --porcelain")) die("Commit or stash your changes before releasing.");

// Capture the exact pre-release commit so we can roll back to it precisely.
const preSha = cap("git rev-parse HEAD");

// 3. Bump → commit → tag LOCALLY (preversion typecheck fires; NO push yet).
console.log(`\nBumping ${bump} version (local commit + tag)…`);
sh(`npm version ${bump} -m "release: %s"`);
const version = JSON.parse(readFileSync("package.json", "utf8")).version;
const tag = `v${version}`;

// 4. Publish FIRST. If it fails, undo the local bump entirely so nothing strands.
console.log(`\nPublishing ${version} to npm…`);
try {
  sh("npm publish");
} catch {
  console.error("\n✗ Publish failed — rolling back the local bump so GitHub stays in sync with npm.");
  try {
    sh(`git tag -d ${tag}`);
    sh(`git reset --hard ${preSha}`); // safe: tree was clean; this only undoes npm version's own commit
    console.error(`  Rolled back to ${preSha.slice(0, 7)} (deleted tag ${tag}). Fix the cause and re-run.`);
  } catch {
    console.error(`  ⚠ Auto-rollback failed. Run manually:  git tag -d ${tag} && git reset --hard ${preSha}`);
  }
  process.exit(1);
}

// 5. Publish succeeded → NOW push the commit + tag to GitHub.
console.log("\nPublished. Pushing commit + tag to GitHub…");
sh("git push --follow-tags");

console.log(`\n✓ Released webdev-orchestrator@${version} — published to npm and pushed to GitHub.`);
console.log(`  Install:  npm install -g webdev-orchestrator@${version}\n`);
