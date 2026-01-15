"use strict";

const { fmtSection, fmtCodeSection, fmtJsonSection, buildSystem } = require("./common");

function buildCommitMessageStreamPrompt(body) {
  const b = body && typeof body === "object" ? body : {};
  const diff = typeof b.diff === "string" ? b.diff : "";
  const stats = b.changed_file_stats ?? b.changedFileStats;

  const system = buildSystem({
    purpose: "generate-commit-message-stream",
    directives: { userGuidelines: "", workspaceGuidelines: "", rulesText: "" },
    outputConstraints: "Generate ONE concise git commit message subject line. Output ONLY the subject line. No quotes, no trailing period."
  });

  const parts = [];
  if (diff) parts.push(fmtCodeSection("Diff", diff, { lang: "diff" }));
  if (stats && typeof stats === "object") parts.push(fmtJsonSection("Changed File Stats", stats, { maxChars: 6000 }));
  const user = parts.filter(Boolean).join("\n\n").trim() || "Generate a commit message for an empty diff.";
  return { system, messages: [{ role: "user", content: user }] };
}

module.exports = { buildCommitMessageStreamPrompt };

