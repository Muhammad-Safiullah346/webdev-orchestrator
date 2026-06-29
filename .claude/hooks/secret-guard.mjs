#!/usr/bin/env node
// secret-guard — PreToolUse hook for Bash + Edit/Write.
// Blocks obviously destructive shell commands and prevents secret values from
// being hardcoded into source. Reads the hook payload as JSON on stdin.
// Exit 0 = allow; print JSON deny to block.

import { readFileSync } from "node:fs";

function read() { try { return JSON.parse(readFileSync(0, "utf8")); } catch { return {}; } }

const deny = (reason) => {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  }));
  process.exit(0);
};

const payload = read();
const tool = payload.tool_name ?? payload.toolName ?? "";
const input = payload.tool_input ?? payload.toolInput ?? {};

// 1. Destructive shell commands.
if (tool === "Bash") {
  const cmd = String(input.command ?? "");
  const danger = [
    /\brm\s+-rf\s+(\/|~|\$HOME)(\s|$)/, // rm -rf / or ~ or $HOME
    /\bgit\s+push\s+.*--force\b/, /\bgit\s+push\s+.*-f\b/,
    /\bgit\s+reset\s+--hard\b.*\borigin\b/,
    /:\(\)\s*\{\s*:\|:&\s*\}\s*;/,       // fork bomb
    /\bmkfs\b/, /\bdd\s+if=.*of=\/dev\//,
    /\b(curl|wget)\b[^|]*\|\s*(sudo\s+)?(ba)?sh\b/, // pipe-to-shell
    /\bchmod\s+-R\s+777\s+\//,
  ];
  for (const re of danger) {
    if (re.test(cmd)) deny(`Blocked a destructive command (${re}). Use a safer, scoped alternative.`);
  }
}

// 2. Hardcoded secrets in written code.
if (tool === "Edit" || tool === "Write") {
  const content = String(input.content ?? input.new_string ?? "");
  const path = String(input.file_path ?? "");
  // Don't scan example/template env files.
  const isExample = /\.env\.(example|sample|template)$/i.test(path);
  const secretPatterns = [
    /\b(sk-[a-zA-Z0-9]{20,})\b/,                       // OpenAI-style keys
    /\bAKIA[0-9A-Z]{16}\b/,                             // AWS access key id
    /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,                   // GitHub tokens
    /-----BEGIN (RSA |EC )?PRIVATE KEY-----/,           // private keys
    /\b(api[_-]?key|secret|password|token)\s*[:=]\s*['"][^'"]{12,}['"]/i,
  ];
  if (!isExample) {
    for (const re of secretPatterns) {
      if (re.test(content)) {
        deny(`Refused to write what looks like a hardcoded secret into ${path || "a file"}. Use an environment variable and reference it by name.`);
      }
    }
  }
}

process.exit(0);
