const test = require("node:test");
const assert = require("node:assert/strict");

const { buildGeminiContents } = require("../payload/extension/out/byok/core/augment-chat");
const { emitGeminiChatJsonAsAugmentChunks } = require("../payload/extension/out/byok/providers/gemini/json-util");
const { RESPONSE_NODE_TOOL_USE_START, RESPONSE_NODE_TOOL_USE } = require("../payload/extension/out/byok/core/augment-protocol");

test("gemini: tool_use_id is forwarded as functionCall.id and functionResponse.id", () => {
  const req = {
    message: "next user message",
    tool_definitions: [],
    chat_history: [
      {
        request_message: "please calculate 1+1",
        response_text: "",
        response_nodes: [
          {
            id: 1,
            type: 5,
            tool_use: {
              tool_use_id: "call-1",
              tool_name: "calculate",
              input_json: "{\"expression\":\"1+1\"}"
            }
          }
        ]
      },
      {
        request_message: "",
        request_nodes: [
          {
            type: 1,
            tool_result_node: {
              tool_use_id: "call-1",
              content: "2",
              is_error: false
            }
          }
        ],
        response_text: "done"
      }
    ]
  };

  const out = buildGeminiContents(req);
  const contents = Array.isArray(out?.contents) ? out.contents : [];

  let functionCall = null;
  let functionResponse = null;
  for (const c of contents) {
    const parts = Array.isArray(c?.parts) ? c.parts : [];
    for (const p of parts) {
      if (p?.functionCall) functionCall = p.functionCall;
      if (p?.functionResponse) functionResponse = p.functionResponse;
    }
  }

  assert.ok(functionCall, "missing functionCall");
  assert.equal(functionCall.id, "call-1");
  assert.equal(functionCall.name, "calculate");

  assert.ok(functionResponse, "missing functionResponse");
  assert.equal(functionResponse.id, "call-1");
  assert.equal(functionResponse.name, "calculate");
});

test("gemini: response functionCall.id is used as tool_use_id in Augment chunks", async () => {
  const json = {
    candidates: [
      {
        index: 0,
        content: {
          role: "model",
          parts: [
            {
              functionCall: {
                id: "call-weather-1",
                name: "get_weather",
                args: { location: "Tokyo", unit: "celsius" }
              }
            }
          ]
        },
        finishReason: "STOP"
      }
    ]
  };

  const chunks = [];
  for await (const c of emitGeminiChatJsonAsAugmentChunks(json, { toolMetaByName: new Map(), supportToolUseStart: true })) chunks.push(c);

  const toolNodes = chunks.flatMap((c) => (Array.isArray(c?.nodes) ? c.nodes : [])).filter((n) => n && typeof n === "object" && n.tool_use);
  assert.ok(toolNodes.length >= 1, "no tool_use nodes emitted");
  assert.ok(
    toolNodes.some(
      (n) =>
        (n.type === RESPONSE_NODE_TOOL_USE_START || n.type === RESPONSE_NODE_TOOL_USE) &&
        n.tool_use &&
        n.tool_use.tool_use_id === "call-weather-1"
    ),
    "tool_use_id not forwarded"
  );
});
