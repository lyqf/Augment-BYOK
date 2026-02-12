const test = require("node:test");
const assert = require("node:assert/strict");

const { applyParallelToolCallsPolicy, isInvalidRequestStatusForFallback } = require("../payload/extension/out/byok/providers/provider-util");

test("isInvalidRequestStatusForFallback: supports 400/422 only", () => {
  assert.equal(isInvalidRequestStatusForFallback(400), true);
  assert.equal(isInvalidRequestStatusForFallback("400"), true);
  assert.equal(isInvalidRequestStatusForFallback(422), true);
  assert.equal(isInvalidRequestStatusForFallback(401), false);
  assert.equal(isInvalidRequestStatusForFallback(null), false);
  assert.equal(isInvalidRequestStatusForFallback(undefined), false);
});

test("applyParallelToolCallsPolicy: injects parallel_tool_calls=false when tools exist and supportParallelToolUse is false", () => {
  const out = applyParallelToolCallsPolicy({}, { hasTools: true, supportParallelToolUse: false });
  assert.equal(out.parallel_tool_calls, false);
});

test("applyParallelToolCallsPolicy: canonicalizes parallelToolCalls to parallel_tool_calls", () => {
  const out = applyParallelToolCallsPolicy({ parallelToolCalls: true, temperature: 0.1 }, { hasTools: true, supportParallelToolUse: false });
  assert.equal(out.parallel_tool_calls, true);
  assert.equal(Object.prototype.hasOwnProperty.call(out, "parallelToolCalls"), false);
  assert.equal(out.temperature, 0.1);
});
