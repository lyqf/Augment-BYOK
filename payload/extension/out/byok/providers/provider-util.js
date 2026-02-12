"use strict";

const { normalizeString } = require("../infra/util");
const { readHttpErrorDetail } = require("./request-util");

const INVALID_REQUEST_FALLBACK_STATUSES = new Set([400, 422]);

function normalizeUsageInt(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

function applyParallelToolCallsPolicy(requestDefaults, { hasTools, supportParallelToolUse } = {}) {
  const rd = requestDefaults && typeof requestDefaults === "object" && !Array.isArray(requestDefaults) ? requestDefaults : {};
  const hasSnake = Object.prototype.hasOwnProperty.call(rd, "parallel_tool_calls");
  const hasCamel = Object.prototype.hasOwnProperty.call(rd, "parallelToolCalls");

  // 兼容：用户可能写 camelCase；OpenAI 实际使用 snake_case。
  if (!hasSnake && hasCamel) {
    const out = { ...rd, parallel_tool_calls: rd.parallelToolCalls };
    delete out.parallelToolCalls;
    return out;
  }

  const tools = hasTools === true;
  if (!tools || supportParallelToolUse === true) return rd;
  if (hasSnake || hasCamel) return rd;
  return { ...rd, parallel_tool_calls: false };
}

function isInvalidRequestStatusForFallback(status) {
  const s = Number(status);
  return Number.isFinite(s) && INVALID_REQUEST_FALLBACK_STATUSES.has(s);
}

function makeToolMetaGetter(toolMetaByName) {
  const map = toolMetaByName instanceof Map ? toolMetaByName : null;
  return (toolName) => {
    if (!map) return { mcpServerName: undefined, mcpToolName: undefined };
    const meta = map.get(toolName);
    return meta && typeof meta === "object" ? meta : { mcpServerName: undefined, mcpToolName: undefined };
  };
}

async function assertSseResponse(resp, { label, expectedHint, previewChars } = {}) {
  const contentType = normalizeString(resp?.headers?.get?.("content-type")).toLowerCase();
  if (contentType.includes("text/event-stream")) return;
  const lim = Number.isFinite(Number(previewChars)) && Number(previewChars) > 0 ? Number(previewChars) : 500;
  const detail = await readHttpErrorDetail(resp, { maxChars: lim });
  const hint = normalizeString(expectedHint) ? `；${String(expectedHint).trim()}` : "";
  throw new Error(`${normalizeString(label) || "SSE"} 响应不是 SSE（content-type=${contentType || "unknown"}）${hint}；detail: ${detail}`.trim());
}

module.exports = {
  normalizeUsageInt,
  applyParallelToolCallsPolicy,
  isInvalidRequestStatusForFallback,
  makeToolMetaGetter,
  assertSseResponse
};
