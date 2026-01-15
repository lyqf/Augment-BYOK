"use strict";

const { historyToMessages, extractDirectives, buildSystem } = require("./common");

function buildConversationTitlePrompt(body) {
  const b = body && typeof body === "object" ? body : {};
  const directives = extractDirectives(b);
  const history = historyToMessages(b.chat_history ?? b.chatHistory, { maxItems: 24 });

  const system = buildSystem({
    purpose: "generate-conversation-title",
    directives,
    outputConstraints: "Generate a short, specific conversation title (<= 8 words). Output ONLY the title."
  });

  const messages = history.length ? [...history, { role: "user", content: "Generate a title for this conversation." }] : [{ role: "user", content: "Generate a title for this conversation." }];
  return { system, messages };
}

module.exports = { buildConversationTitlePrompt };
