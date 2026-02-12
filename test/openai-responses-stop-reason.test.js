const test = require("node:test");
const assert = require("node:assert/strict");

const {
  extractStopReasonFromResponsesObject,
  emitOpenAiResponsesJsonAsAugmentChunks
} = require("../payload/extension/out/byok/providers/openai-responses/json-util");
const { STOP_REASON_MAX_TOKENS, STOP_REASON_SAFETY } = require("../payload/extension/out/byok/core/augment-protocol");

test("openai-responses: maps incomplete_details.reason to Augment stop_reason", () => {
  const a = extractStopReasonFromResponsesObject({ status: "incomplete", incomplete_details: { reason: "max_output_tokens" } });
  assert.equal(a.stopReasonSeen, true);
  assert.equal(a.stopReason, STOP_REASON_MAX_TOKENS);

  const b = extractStopReasonFromResponsesObject({ status: "incomplete", incomplete_details: { reason: "content_filter" } });
  assert.equal(b.stopReasonSeen, true);
  assert.equal(b.stopReason, STOP_REASON_SAFETY);
});

test("openai-responses: emitOpenAiResponsesJsonAsAugmentChunks uses mapped stop_reason", async () => {
  const json = {
    id: "resp_test",
    object: "response",
    status: "incomplete",
    incomplete_details: { reason: "max_output_tokens" },
    output_text: "hello",
    usage: { input_tokens: 1, output_tokens: 2 }
  };

  const chunks = [];
  for await (const c of emitOpenAiResponsesJsonAsAugmentChunks(json, { toolMetaByName: new Map(), supportToolUseStart: true })) chunks.push(c);

  assert.ok(chunks.length >= 1);
  const last = chunks[chunks.length - 1];
  assert.equal(last.stop_reason, STOP_REASON_MAX_TOKENS);
});
