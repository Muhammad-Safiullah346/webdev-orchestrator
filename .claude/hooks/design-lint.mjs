#!/usr/bin/env node
// design-lint — PostToolUse hook for Edit/Write on style/markup files.
// Non-blocking: it warns (via stderr + a context note) when the AI-slop
// fingerprint appears in written CSS/Tailwind/JSX so the agent self-corrects.
// It never blocks — the visual-qa agent is the real gate.

import { readFileSync } from "node:fs";

function read() { try { return JSON.parse(readFileSync(0, "utf8")); } catch { return {}; } }

const payload = read();
const tool = payload.tool_name ?? payload.toolName ?? "";
if (tool !== "Edit" && tool !== "Write") process.exit(0);

const input = payload.tool_input ?? payload.toolInput ?? {};
const path = String(input.file_path ?? "");
if (!/\.(css|scss|tsx?|jsx?|vue|svelte|html|astro)$/i.test(path)) process.exit(0);

const content = String(input.content ?? input.new_string ?? "");
const warnings = [];

// The documented slop fingerprint.
if (/font-family\s*:\s*['"]?(Inter|Roboto|Arial)\b/i.test(content) ||
    /\bfont-(sans|family)-\[?['"]?Inter/i.test(content)) {
  warnings.push("Inter/Roboto/Arial used as a brand face — pick a distinctive pairing from the design system.");
}
if (/linear-gradient\([^)]*(#?(6366f1|7c3aed|8b5cf6|a855f7)|purple|indigo|violet)[^)]*(blue|#3b82f6|indigo)/i.test(content)) {
  warnings.push("Purple→indigo/blue gradient detected — the #1 slop tell. Use a dominant color + sharp accent.");
}
if (/box-shadow\s*:\s*0\s+1px\s+3px\s+rgba\(0,\s*0,\s*0,\s*0?\.1\)/i.test(content) ||
    /shadow-\[0_1px_3px_rgba\(0,0,0,0\.1\)\]/i.test(content)) {
  warnings.push("Flat 0 1px 3px / 0.1-opacity shadow on everything — use a deliberate elevation scale.");
}
// Heuristic: three identical cards in a row (default feature grid).
if (/grid-cols-3\b/.test(content) && /\bcard\b/i.test(content) && (content.match(/grid-cols-3/g)?.length ?? 0) >= 1
    && /(feature|card).*card.*card/is.test(content.replace(/\s+/g, " "))) {
  warnings.push("Possible three-equal-card grid — consider a real focal hierarchy instead.");
}

if (warnings.length) {
  const note = "⚠ design-lint (slop fingerprint) in " + path + ":\n - " + warnings.join("\n - ");
  process.stderr.write(note + "\n");
  // Feed the warning back into the agent's context so it self-corrects.
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: note + "\nThese are banned by the design law. Fix before the visual-QA gate.",
    },
  }));
}
process.exit(0);
