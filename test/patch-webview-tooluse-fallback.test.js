const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { patchWebviewToolUseFallback } = require("../tools/patch/patch-webview-tooluse-fallback");

function withTempDir(prefix, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function writeUtf8(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function readUtf8(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function makeFixture() {
  return [
    // extension-client-context selector
    'a8=I(((e,t,n)=>{if(!n||!t)return[];const i=rt.select(e,t,n),a=i?.structured_output_nodes?.filter((r=>r.type===de.TOOL_USE));if(!a)return[];let o=!1;return a.filter((r=>{if(o||!r.tool_use)return!1;const s=Oi.select(e,r.requestId??n,r.tool_use?.tool_use_id);return s.phase!==K.new&&s.phase!==K.unknown&&s.phase!==K.checkingSafety&&(s.phase!==K.runnable||(o=!0,!0))}))}));',
    // toolUseState selector
    'Oi=I(((e,t,n)=>{if(!n)return{requestId:t,toolUseId:"",result:void 0,phase:K.unknown};const i=e.tools.toolsByRequest[t];return(i?H(i,n):void 0)||{requestId:t,toolUseId:n,result:void 0,phase:K.new}}));',
    'var M={sent:"sent"};var Ze={TOOL_RESULT:"tool_result"};',
    'function qi(e){return !!(e&&e.request_message)}',
    ""
  ].join("");
}

test("patchWebviewToolUseFallback: patches latest tool list flow", () => {
  withTempDir("augment-byok-webview-tooluse-", (dir) => {
    const extDir = path.join(dir, "extension");
    const assetsDir = path.join(extDir, "common-webviews", "assets");
    const selectorFilePath = path.join(assetsDir, "extension-client-context-test.js");
    writeUtf8(selectorFilePath, makeFixture());

    patchWebviewToolUseFallback(extDir);

    const selectorOut = readUtf8(selectorFilePath);
    assert.ok(selectorOut.includes("__byok_displayable_tool_nodes_fallback"), "selector fallback not applied");
    assert.ok(selectorOut.includes("i?.status===M.sent"), "selector should preserve live turn behavior");
    assert.ok(selectorOut.includes("a.filter((r=>!!r.tool_use))"), "selector should fall back to raw tool nodes");
    assert.ok(selectorOut.includes("__augment_byok_webview_tooluse_selector_fallback_v1"), "selector marker missing");
    assert.ok(selectorOut.includes("__byok_existing=i?H(i,n):void 0;"), "tool state selector fallback not applied");
    assert.ok(selectorOut.includes("Object.values(e.conversationHistory.history)"), "tool state fallback should scan hydrated histories");
    assert.ok(selectorOut.includes("__byok_node.type===Ze.TOOL_RESULT"), "tool state fallback should restore from tool result nodes");
    assert.ok(selectorOut.includes("__byok_result.is_error?K.error:K.completed"), "tool state fallback should restore phase");
    assert.ok(
      selectorOut.includes("__augment_byok_webview_tooluse_state_selector_fallback_v1"),
      "tool state selector marker missing"
    );
  });
});
