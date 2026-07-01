#!/usr/bin/env node
// One-command release: guard → bump → push → publish.
//
//   npm run release          # patch  (1.0.0 → 1.0.1)
//   npm run release:minor    # minor  (1.0.0 → 1.1.0)
//   npm run release:major    # major  (1.0.0 → 2.0.0)
//
// `npm version` (invoked below) fires the lifecycle hooks in package.json:
//   preversion  → typecheck            (abort before bumping if the build is broken)
//   postversion → git push --follow-tags  (commit + tag land on GitHub)
// then `npm publish` fires prepublishOnly → typecheck again as a final gate.
//
// Guards run FIRST so a failed precondition never leaves a half-released state
// (bumped + pushed but not published).

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const bump = process.argv[2] ?? "patch";
const sh = (cmd) => execSync(cmd, { stdio: "inherit" });
const cap = (cmd) => execSync(cmd, { encoding: "utf8" }).trim();
const die = (msg) => { console.error(`\n✗ ${msg}\n`); process.exit(1); };

// 1. Logged into npm? (checked before any mutation so we can't strand a bump.)
let npmUser;
try { npmUser = cap("npm whoami 2>/dev/null"); }
catch { die("Not logged into npm. Run `npm login` first (free account, public packages cost nothing)."); }
console.log(`npm user:  ${npmUser}`);

// 2. Clean working tree? (npm version also enforces this, but fail early + friendly.)
const dirty = cap("git status --porcelain");
if (dirty) die(`Commit or stash your changes before releasing:\n${dirty}`);

// 3. Bump → commit → tag → push (via the version lifecycle hooks).
console.log(`\nReleasing a ${bump} version…`);
sh(`npm version ${bump} -m "release: %s"`);

// 4. Publish to npm (prepublishOnly typecheck runs as the final gate).
console.log("\nPublishing to npm…");
sh("npm publish");

const version = JSON.parse(readFileSync("package.json", "utf8")).version;
console.log(`\n✓ Released webdev-orchestrator@${version} — pushed to GitHub and published to npm.`);
console.log(`  Install:  npm install -g webdev-orchestrator@${version}\n`);
