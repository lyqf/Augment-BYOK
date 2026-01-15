"use strict";

const { normalizeString } = require("../util");
const { fmtSection, fmtCodeSection, extractDirectives, buildSystem, extractCodeContext } = require("./common");

function buildNextEditStreamPrompt(body) {
  const b = body && typeof body === "object" ? body : {};
  const directives = extractDirectives(b);
  const lang = normalizeString(b.lang);
  const path = normalizeString(b.path);
  const instruction = normalizeString(b.instruction) || "Propose the next code edit.";
  const { prefix, selectedText, suffix } = extractCodeContext(b);

  const system = buildSystem({
    purpose: "next-edit-stream",
    directives,
    outputConstraints: "Propose the next minimal edit. Output ONLY the replacement code for the selected range. No markdown, no explanations."
  });

  const parts = [];
  if (instruction) parts.push(fmtSection("Instruction", instruction));
  if (path) parts.push(fmtSection("Path", path));
  if (lang) parts.push(fmtSection("Language", lang));
  if (prefix) parts.push(fmtCodeSection("Prefix", prefix, { lang }));
  if (selectedText) parts.push(fmtCodeSection("Selected (replace this)", selectedText, { lang }));
  if (suffix) parts.push(fmtCodeSection("Suffix", suffix, { lang }));

  const user = parts.filter(Boolean).join("\n\n").trim() || "Propose an edit.";
  return { system, messages: [{ role: "user", content: user }] };
}

module.exports = { buildNextEditStreamPrompt };

