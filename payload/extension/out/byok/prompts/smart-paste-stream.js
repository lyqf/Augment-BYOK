"use strict";

const { normalizeString } = require("../util");
const { fmtSection, fmtCodeSection, extractDirectives, buildSystem, extractCodeContext } = require("./common");

function buildSmartPasteStreamPrompt(body) {
  const b = body && typeof body === "object" ? body : {};
  const directives = extractDirectives(b);
  const lang = normalizeString(b.lang);
  const path = normalizeString(b.path);
  const instruction = normalizeString(b.instruction) || "Integrate the pasted code into the target context.";
  const codeBlock = typeof b.code_block === "string" ? b.code_block : "";
  const { prefix, selectedText, suffix } = extractCodeContext(b);

  const system = buildSystem({
    purpose: "smart-paste-stream",
    directives,
    outputConstraints: "Integrate the pasted code into context. Output ONLY the final code to replace the selected range. No markdown, no explanations."
  });

  const parts = [];
  if (instruction) parts.push(fmtSection("Instruction", instruction));
  if (path) parts.push(fmtSection("Path", path));
  if (lang) parts.push(fmtSection("Language", lang));
  if (codeBlock) parts.push(fmtCodeSection("Pasted Code Block", codeBlock, { lang }));
  if (prefix) parts.push(fmtCodeSection("Prefix", prefix, { lang }));
  if (selectedText) parts.push(fmtCodeSection("Selected (replace this)", selectedText, { lang }));
  if (suffix) parts.push(fmtCodeSection("Suffix", suffix, { lang }));

  const user = parts.filter(Boolean).join("\n\n").trim() || "Smart paste.";
  return { system, messages: [{ role: "user", content: user }] };
}

module.exports = { buildSmartPasteStreamPrompt };

