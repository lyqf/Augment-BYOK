"use strict";

const { normalizeString, randomId } = require("./util");
const { buildChatPrompt } = require("./prompts/chat");
const { buildPromptEnhancerPrompt } = require("./prompts/prompt-enhancer");
const { buildCompletionPrompt } = require("./prompts/completion");
const { buildChatInputCompletionPrompt } = require("./prompts/chat-input-completion");
const { buildEditPrompt } = require("./prompts/edit");
const { buildInstructionStreamPrompt } = require("./prompts/instruction-stream");
const { buildSmartPasteStreamPrompt } = require("./prompts/smart-paste-stream");
const { buildCommitMessageStreamPrompt } = require("./prompts/commit-message-stream");
const { buildConversationTitlePrompt } = require("./prompts/conversation-title");
const { buildNextEditStreamPrompt } = require("./prompts/next-edit-stream");

function buildMessagesForEndpoint(endpoint, body) {
  const ep = normalizeString(endpoint);
  if (ep === "/completion") return buildCompletionPrompt(body);
  if (ep === "/chat-input-completion") return buildChatInputCompletionPrompt(body);
  if (ep === "/edit") return buildEditPrompt(body);
  if (ep === "/instruction-stream") return buildInstructionStreamPrompt(body);
  if (ep === "/smart-paste-stream") return buildSmartPasteStreamPrompt(body);
  if (ep === "/generate-commit-message-stream") return buildCommitMessageStreamPrompt(body);
  if (ep === "/generate-conversation-title") return buildConversationTitlePrompt(body);
  if (ep === "/next-edit-stream") return buildNextEditStreamPrompt(body);
  if (ep === "/prompt-enhancer") return buildPromptEnhancerPrompt(body);
  if (ep === "/chat" || ep === "/chat-stream") return buildChatPrompt(ep, body);
  return buildChatPrompt(ep, body);
}

function makeBackChatResult(text, { nodes, includeNodes = true } = {}) {
  const out = {
    text: typeof text === "string" ? text : String(text ?? ""),
    unknown_blob_names: [],
    checkpoint_not_found: false,
    workspace_file_chunks: []
  };
  if (includeNodes) out.nodes = Array.isArray(nodes) ? nodes : [];
  return out;
}

function makeBackCompletionResult(text, { timeoutMs } = {}) {
  const out = { text: typeof text === "string" ? text : String(text ?? ""), unknown_blob_names: [], checkpoint_not_found: false };
  if (Number.isFinite(Number(timeoutMs))) out.completion_timeout_ms = Number(timeoutMs);
  return out;
}

function makeBackCodeEditResult(text) {
  return { text: typeof text === "string" ? text : String(text ?? ""), unknown_blob_names: [], checkpoint_not_found: false };
}

function makeBackChatInstructionChunk(text) {
  return { text: typeof text === "string" ? text : String(text ?? ""), unknown_blob_names: [], checkpoint_not_found: false };
}

function makeBackGenerateCommitMessageChunk(text) {
  return { text: typeof text === "string" ? text : String(text ?? "") };
}

function makeBackNextEditGenerationChunk({ path, blobName, charStart, charEnd, existingCode, suggestedCode }) {
  const p = normalizeString(path) || "(unknown)";
  const b = normalizeString(blobName) || "(unknown)";
  const cs = Number.isFinite(Number(charStart)) ? Number(charStart) : 0;
  const ce = Number.isFinite(Number(charEnd)) && Number(charEnd) >= cs ? Number(charEnd) : cs;
  const ex = typeof existingCode === "string" ? existingCode : "";
  const su = typeof suggestedCode === "string" ? suggestedCode : "";
  return {
    unknown_blob_names: [],
    checkpoint_not_found: false,
    next_edit: {
      suggestion_id: `byok:${randomId()}`,
      path: p,
      blob_name: b,
      char_start: cs,
      char_end: ce,
      existing_code: ex,
      suggested_code: su,
      change_description: "BYOK suggestion",
      editing_score: 1,
      localization_score: 1,
      editing_score_threshold: 1
    }
  };
}

function makeBackNextEditLocationEmpty() {
  return { candidate_locations: [], unknown_blob_names: [], checkpoint_not_found: false, critical_errors: [] };
}

function buildByokModelsFromConfig(cfg) {
  const out = new Set();
  const providers = Array.isArray(cfg?.providers) ? cfg.providers : [];
  for (const p of providers) {
    const pid = normalizeString(p?.id);
    const dm = normalizeString(p?.defaultModel);
    if (pid && dm) out.add(`byok:${pid}:${dm}`);
  }
  const map = cfg?.routing?.modelMap && typeof cfg.routing.modelMap === "object" ? cfg.routing.modelMap : null;
  if (map) {
    for (const v of Object.values(map)) {
      const s = normalizeString(v);
      if (s.startsWith("byok:")) out.add(s);
    }
  }
  return Array.from(out);
}

function makeBackGetModelsResult({ defaultModel, models }) {
  const dm = normalizeString(defaultModel) || (Array.isArray(models) && models.length ? models[0].name : "unknown");
  const ms = Array.isArray(models) ? models : [];
  return { default_model: dm, models: ms, feature_flags: {} };
}

function makeModelInfo(name) {
  return { name, suggested_prefix_char_count: 0, suggested_suffix_char_count: 0, completion_timeout_ms: 120000 };
}

module.exports = {
  buildMessagesForEndpoint,
  makeBackChatResult,
  makeBackCompletionResult,
  makeBackCodeEditResult,
  makeBackChatInstructionChunk,
  makeBackGenerateCommitMessageChunk,
  makeBackNextEditGenerationChunk,
  makeBackNextEditLocationEmpty,
  buildByokModelsFromConfig,
  makeBackGetModelsResult,
  makeModelInfo
};
