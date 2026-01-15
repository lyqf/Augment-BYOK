"use strict";

const { normalizeString } = require("../util");
const { fmtSection, fmtCodeSection, buildSystem } = require("./common");

function buildCompletionPrompt(body) {
  const b = body && typeof body === "object" ? body : {};
  const lang = normalizeString(b.lang);
  const path = normalizeString(b.path);
  const prompt = typeof b.prompt === "string" ? b.prompt : "";
  const suffix = typeof b.suffix === "string" ? b.suffix : "";

  const system = buildSystem({
    purpose: "completion",
    directives: { userGuidelines: "", workspaceGuidelines: "", rulesText: "" },
    outputConstraints: "You are a code completion engine. Output ONLY the completion text. No markdown, no explanations."
  });

  const parts = [];
  if (lang) parts.push(fmtSection("Language", lang));
  if (path) parts.push(fmtSection("Path", path));
  if (prompt) parts.push(fmtCodeSection("Prefix (prompt)", prompt, { lang }));
  if (suffix) parts.push(fmtCodeSection("Suffix", suffix, { lang }));

  const user = parts.filter(Boolean).join("\n\n").trim() || "Complete the code.";
  return { system, messages: [{ role: "user", content: user }] };
}

module.exports = { buildCompletionPrompt };

