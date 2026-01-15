"use strict";

const { normalizeString } = require("../util");
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

function buildChatPrompt(endpoint, body) {
  const b = body && typeof body === "object" ? body : {};
  const ep = normalizeString(endpoint) || "/chat";
  const directives = extractDirectives(b);

  const system = buildSystem({
    purpose: `chat${ep === "/chat-stream" ? ":stream" : ""}`,
    directives,
    outputConstraints: "Output helpful assistant text. Use Markdown when it improves readability."
  });

  const history = historyToMessages(b.chat_history ?? b.chatHistory, { maxItems: 16 });
  const msg = pickMessageText(b);
  const { prefix, selectedText, suffix, combined } = extractCodeContext(b);

  const parts = [];
  if (msg) parts.push(fmtSection("Message", msg));
  const mode = normalizeString(b.mode);
  if (mode) parts.push(fmtSection("Mode", mode));
  if (combined.trim()) parts.push(fmtCodeSection("Code Context (prefix+selection+suffix)", combined));
  else {
    if (prefix.trim()) parts.push(fmtCodeSection("Prefix", prefix));
    if (selectedText.trim()) parts.push(fmtCodeSection("Selected", selectedText));
    if (suffix.trim()) parts.push(fmtCodeSection("Suffix", suffix));
  }

  const nodes = b.nodes;
  if (Array.isArray(nodes) && nodes.length) parts.push(fmtJsonSection("Nodes", nodes, { maxChars: 12000 }));

  const toolDefs = b.tool_definitions ?? b.toolDefinitions;
  if (Array.isArray(toolDefs) && toolDefs.length) parts.push(fmtJsonSection("Tool Definitions", toolDefs, { maxChars: 12000 }));

  const user = parts.filter(Boolean).join("\n\n").trim() || "Hello";
  return { system, messages: [...history, { role: "user", content: user }] };
}

module.exports = { buildChatPrompt };

