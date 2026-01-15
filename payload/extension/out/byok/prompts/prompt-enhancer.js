"use strict";

const {
  fmtSection,
  fmtCodeSection,
  fmtJsonSection,
  historyToMessages,
  pickMessageText,
  extractDirectives,
  buildSystem,
  extractCodeContext
} = require("./common");

function buildPromptEnhancerPrompt(body) {
  const b = body && typeof body === "object" ? body : {};
  const directives = extractDirectives(b);

  const system = buildSystem({
    purpose: "prompt-enhancer",
    directives,
    outputConstraints: "Rewrite the prompt to be clearer and more specific. Output ONLY the improved prompt text. No preface, no analysis."
  });

  const history = historyToMessages(b.chat_history ?? b.chatHistory, { maxItems: 12 });
  const msg = pickMessageText(b);
  const { combined } = extractCodeContext(b);

  const parts = [];
  if (msg) parts.push(fmtSection("Original Prompt", msg));
  if (combined.trim()) parts.push(fmtCodeSection("Code Context", combined));

  const nodes = b.nodes;
  if (Array.isArray(nodes) && nodes.length) parts.push(fmtJsonSection("Nodes", nodes, { maxChars: 8000 }));

  const user = parts.filter(Boolean).join("\n\n").trim() || "Rewrite the prompt.";
  return { system, messages: [...history, { role: "user", content: user }] };
}

module.exports = { buildPromptEnhancerPrompt };

