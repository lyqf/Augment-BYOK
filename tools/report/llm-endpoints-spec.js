"use strict";

// 单一真相：LLM 端点集合（13）+ 输入/输出形状摘要 + 上游期望 Back 类型
// - 用于生成覆盖矩阵报告（markdown）
// - 用于 CI fail-fast：上游若移除/新增/改变调用类型（callApi vs callApiStream）会直接失败

const LLM_ENDPOINT_SPECS = [
  {
    endpoint: "/get-models",
    kind: "callApi",
    upstreamBackType: "BackGetModelsResult",
    inputKeys: [],
    outputKeys: ["default_model", "models[]", "feature_flags", "languages?", "user_tier?", "user?"],
    byokImpl: "shim.maybeHandleCallApi(/get-models): merge official + add byok:* models"
  },
  {
    endpoint: "/chat",
    kind: "callApi",
    upstreamBackType: "BackChatResult",
    inputKeys: ["message|prompt|instruction", "chat_history?", "nodes?", "user_guidelines?", "workspace_guidelines?", "rules?", "prefix?", "selected_text|selected_code?", "suffix?"],
    outputKeys: ["text", "unknown_blob_names[]", "checkpoint_not_found", "workspace_file_chunks[]", "nodes[]"],
    byokImpl: "protocol.buildMessagesForEndpoint(/chat) -> provider.completeText -> BackChatResult"
  },
  {
    endpoint: "/chat-stream",
    kind: "callApiStream",
    upstreamBackType: "BackChatResult (stream chunks)",
    inputKeys: ["message|prompt|instruction", "chat_history?", "nodes?", "user_guidelines?", "workspace_guidelines?", "rules?", "prefix?", "selected_text|selected_code?", "suffix?"],
    outputKeys: ["text (delta)", "unknown_blob_names[]", "checkpoint_not_found", "workspace_file_chunks[]", "nodes[] (first chunk only)"],
    byokImpl: "provider SSE -> stream text deltas -> BackChatResult chunks"
  },
  {
    endpoint: "/prompt-enhancer",
    kind: "callApiStream",
    upstreamBackType: "BackChatResult (stream chunks)",
    inputKeys: ["nodes?", "chat_history?", "instruction|message|prompt", "user_guidelines?", "workspace_guidelines?", "rules?"],
    outputKeys: ["text (enhanced prompt delta)", "unknown_blob_names[]", "checkpoint_not_found", "workspace_file_chunks[]", "nodes[] (first chunk only)"],
    byokImpl: "prompt rewrite stream (BackChatResult)"
  },
  {
    endpoint: "/completion",
    kind: "callApi",
    upstreamBackType: "BackCompletionResult",
    inputKeys: ["prompt", "suffix?", "lang?", "path?", "prefix_begin?", "cursor_position?", "suffix_end?"],
    outputKeys: ["text (or completion_items)", "unknown_blob_names[]", "checkpoint_not_found", "suggested_prefix_char_count?", "suggested_suffix_char_count?", "completion_timeout_ms?"],
    byokImpl: "completion prompt -> provider.completeText -> BackCompletionResult(text)"
  },
  {
    endpoint: "/chat-input-completion",
    kind: "callApi",
    upstreamBackType: "BackCompletionResult",
    inputKeys: ["prompt", "suffix?", "lang?", "path?"],
    outputKeys: ["text (or completion_items)", "unknown_blob_names[]", "checkpoint_not_found"],
    byokImpl: "chat-input completion prompt -> provider.completeText"
  },
  {
    endpoint: "/edit",
    kind: "callApi",
    upstreamBackType: "BackCodeEditResult",
    inputKeys: ["instruction", "prefix?", "selected_text", "suffix?", "lang?", "path?"],
    outputKeys: ["text", "unknown_blob_names[]", "checkpoint_not_found"],
    byokImpl: "edit instruction -> provider.completeText -> BackCodeEditResult(text)"
  },
  {
    endpoint: "/instruction-stream",
    kind: "callApiStream",
    upstreamBackType: "BackChatInstructionStreamResult (stream chunks)",
    inputKeys: ["instruction", "prefix?", "selected_text", "suffix?", "lang?", "path?"],
    outputKeys: ["text (delta)", "unknown_blob_names[]", "checkpoint_not_found", "replacement_*?"],
    byokImpl: "instruction stream -> BackChatInstructionStreamResult(text)"
  },
  {
    endpoint: "/smart-paste-stream",
    kind: "callApiStream",
    upstreamBackType: "BackChatInstructionStreamResult (stream chunks)",
    inputKeys: ["instruction", "prefix?", "selected_text", "suffix?", "lang?", "path?", "code_block?"],
    outputKeys: ["text (delta)", "unknown_blob_names[]", "checkpoint_not_found", "replacement_*?"],
    byokImpl: "smart paste stream -> BackChatInstructionStreamResult(text)"
  },
  {
    endpoint: "/generate-commit-message-stream",
    kind: "callApiStream",
    upstreamBackType: "{text} (stream chunks)",
    inputKeys: ["diff", "changed_file_stats?"],
    outputKeys: ["text (delta/partial)"],
    byokImpl: "commit msg stream -> {text}"
  },
  {
    endpoint: "/generate-conversation-title",
    kind: "callApiStream",
    upstreamBackType: "BackChatResult (stream chunks)",
    inputKeys: ["chat_history"],
    outputKeys: ["text (title delta)", "unknown_blob_names[]", "checkpoint_not_found", "workspace_file_chunks[]", "nodes[] (first chunk only)"],
    byokImpl: "title stream -> BackChatResult"
  },
  {
    endpoint: "/next-edit-stream",
    kind: "callApiStream",
    upstreamBackType: "BackNextEditGenerationResult (single event)",
    inputKeys: ["instruction", "prefix?", "selected_text?", "suffix?", "path", "blob_name?", "selection_begin_char?", "selection_end_char?"],
    outputKeys: ["unknown_blob_names[]", "checkpoint_not_found", "next_edit{suggestion_id,path,blob_name,char_start,char_end,existing_code,suggested_code,...}"],
    byokImpl: "provider.completeText -> BackNextEditGenerationResult(next_edit)"
  },
  {
    endpoint: "/next_edit_loc",
    kind: "callApi",
    upstreamBackType: "BackNextEditLocationResult",
    inputKeys: ["instruction", "path", "num_results?", "is_single_file?"],
    outputKeys: ["candidate_locations[]", "unknown_blob_names[]", "checkpoint_not_found", "critical_errors[]"],
    byokImpl: "v1: returns empty candidates (safe fallback)"
  }
];

module.exports = { LLM_ENDPOINT_SPECS };

