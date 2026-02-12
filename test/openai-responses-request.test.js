const test = require("node:test");
const assert = require("node:assert/strict");

const { buildOpenAiResponsesRequest, buildMinimalRetryRequestDefaults } = require("../payload/extension/out/byok/providers/openai-responses/request");

test("openai-responses request: maps max_tokens/maxTokens/maxOutputTokens -> max_output_tokens", () => {
  const { body } = buildOpenAiResponsesRequest({
    baseUrl: "https://api.example.com/v1",
    apiKey: "sk_test",
    model: "gpt-4o-mini",
    instructions: "",
    input: [],
    tools: [],
    extraHeaders: {},
    requestDefaults: { max_tokens: 123, maxTokens: 999, maxOutputTokens: 77 },
    stream: false
  });

  assert.equal(body.max_output_tokens, 77);
  assert.equal("max_tokens" in body, false);
  assert.equal("maxTokens" in body, false);
  assert.equal("maxOutputTokens" in body, false);
});

test("openai-responses request: maps max_completion_tokens -> max_output_tokens", () => {
  const { body } = buildOpenAiResponsesRequest({
    baseUrl: "https://api.example.com/v1",
    apiKey: "sk_test",
    model: "gpt-4o-mini",
    instructions: "",
    input: [],
    tools: [],
    extraHeaders: {},
    requestDefaults: { max_completion_tokens: 200 },
    stream: false
  });

  assert.equal(body.max_output_tokens, 200);
  assert.equal("max_completion_tokens" in body, false);
});

test("openai-responses request: minimal defaults keeps max_output_tokens only", () => {
  const out = buildMinimalRetryRequestDefaults({ max_tokens: 321, temperature: 0.2, some_unknown: "x" });
  assert.deepEqual(out, { max_output_tokens: 321 });
});

test("openai-responses request: canonicalizes parallelToolCalls -> parallel_tool_calls", () => {
  const { body } = buildOpenAiResponsesRequest({
    baseUrl: "https://api.example.com/v1",
    apiKey: "sk_test",
    model: "gpt-4o-mini",
    instructions: "",
    input: [],
    tools: [],
    extraHeaders: {},
    requestDefaults: { parallelToolCalls: false },
    stream: false
  });

  assert.equal(body.parallel_tool_calls, false);
  assert.equal("parallelToolCalls" in body, false);
});
