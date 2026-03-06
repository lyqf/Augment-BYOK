#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const { ensureMarker, replaceOnceRegex } = require("../lib/patch");

const MARKER_DISPLAYABLE_TOOL_NODES = "__augment_byok_webview_tooluse_selector_fallback_v1";
const MARKER_TOOL_STATE_SELECTOR = "__augment_byok_webview_tooluse_state_selector_fallback_v1";

function patchExtensionClientContextAsset(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`missing file: ${filePath}`);
  const original = fs.readFileSync(filePath, "utf8");
  let out = original;
  const applied = [];

  // selectExchangeDisplayableToolNodesOnly 会在 toolUseState 缺失时把历史 TOOL_USE 全过滤掉。
  // 对“已完成/历史回放”turn，这会导致工具区整体消失。稳定兜底放到 selector 层：
  // - 先保留上游基于 tool phase 的过滤；
  // - 若过滤结果为空且该 exchange 已不是 sent（即不是正在进行中的 live turn），
  //   则直接回退到 exchange 自身的 TOOL_USE nodes。
  if (!out.includes(MARKER_DISPLAYABLE_TOOL_NODES)) {
    const alreadyPatched = out.includes("__byok_displayable_tool_nodes_fallback");
    if (!alreadyPatched) {
      out = replaceOnceRegex(
        out,
        /([A-Za-z_$][0-9A-Za-z_$]*)=I\(\(\(([A-Za-z_$][0-9A-Za-z_$]*),([A-Za-z_$][0-9A-Za-z_$]*),([A-Za-z_$][0-9A-Za-z_$]*)\)=>\{if\(!\4\|\|!\3\)return\[\];const ([A-Za-z_$][0-9A-Za-z_$]*)=rt\.select\(\2,\3,\4\),([A-Za-z_$][0-9A-Za-z_$]*)=\5\?\.structured_output_nodes\?\.filter\(\(([A-Za-z_$][0-9A-Za-z_$]*)=>\7\.type===de\.TOOL_USE\)\);if\(!\6\)return\[\];let ([A-Za-z_$][0-9A-Za-z_$]*)=!1;return \6\.filter\(\(\7=>\{if\(\8\|\|!\7\.tool_use\)return!1;const ([A-Za-z_$][0-9A-Za-z_$]*)=Oi\.select\(\2,\7\.requestId\?\?\4,\7\.tool_use\?\.tool_use_id\);return \9\.phase!==K\.new&&\9\.phase!==K\.unknown&&\9\.phase!==K\.checkingSafety&&\(\9\.phase!==K\.runnable\|\|\(\8=!0,!0\)\)\}\)\)\}\)\);/g,
        (m) => {
          const selectorVar = m[1];
          const stateVar = m[2];
          const conversationIdVar = m[3];
          const requestIdVar = m[4];
          const exchangeVar = m[5];
          const nodesVar = m[6];
          const nodeVar = m[7];
          const breakVar = m[8];
          const toolStateVar = m[9];
          return `${selectorVar}=I(((${stateVar},${conversationIdVar},${requestIdVar})=>{if(!${requestIdVar}||!${conversationIdVar})return[];const ${exchangeVar}=rt.select(${stateVar},${conversationIdVar},${requestIdVar}),${nodesVar}=${exchangeVar}?.structured_output_nodes?.filter((${nodeVar}=>${nodeVar}.type===de.TOOL_USE));if(!${nodesVar})return[];let ${breakVar}=!1;const __byok_displayable_tool_nodes_fallback=${nodesVar}.filter((${nodeVar}=>{if(${breakVar}||!${nodeVar}.tool_use)return!1;const ${toolStateVar}=Oi.select(${stateVar},${nodeVar}.requestId??${requestIdVar},${nodeVar}.tool_use?.tool_use_id);return ${toolStateVar}.phase!==K.new&&${toolStateVar}.phase!==K.unknown&&${toolStateVar}.phase!==K.checkingSafety&&(${toolStateVar}.phase!==K.runnable||(${breakVar}=!0,!0))}));return __byok_displayable_tool_nodes_fallback.length||${exchangeVar}?.status===M.sent?__byok_displayable_tool_nodes_fallback:${nodesVar}.filter((${nodeVar}=>!!${nodeVar}.tool_use))})));`;
        },
        "extension-client-context displayable tool nodes fallback"
      );
      applied.push("displayable_selector");
    }
    out = ensureMarker(out, MARKER_DISPLAYABLE_TOOL_NODES);
  }

  // selectToolUseState 在 tools slice 缺失时默认返回 phase=new，导致 ToolUse 组件无法展示历史结果。
  // 稳定兜底：从同一 conversation group 里向后扫描 TOOL_RESULT request nodes，恢复 completed/error 状态。
  if (!out.includes(MARKER_TOOL_STATE_SELECTOR)) {
    const alreadyPatched = out.includes("__byok_tool_state_selector_fallback");
    if (!alreadyPatched) {
      out = replaceOnceRegex(
        out,
        /([A-Za-z_$][0-9A-Za-z_$]*)=I\(\(\(([A-Za-z_$][0-9A-Za-z_$]*),([A-Za-z_$][0-9A-Za-z_$]*),([A-Za-z_$][0-9A-Za-z_$]*)\)=>\{if\(!\4\)return\{requestId:\3,toolUseId:"",result:void 0,phase:K\.unknown\};const ([A-Za-z_$][0-9A-Za-z_$]*)=\2\.tools\.toolsByRequest\[\3\];return\(\5\?H\(\5,\4\):void 0\)\|\|\{requestId:\3,toolUseId:\4,result:void 0,phase:K\.new\}\}\)\)/g,
        (m) =>
          `${m[1]}=I(((${m[2]},${m[3]},${m[4]})=>{if(!${m[4]})return{requestId:${m[3]},toolUseId:"",result:void 0,phase:K.unknown};const ${m[5]}=${m[2]}.tools.toolsByRequest[${m[3]}],__byok_existing=${m[5]}?H(${m[5]},${m[4]}):void 0;if(__byok_existing)return __byok_existing;try{const __byok_histories=${m[2]}.conversationHistory&&${m[2]}.conversationHistory.history?Object.values(${m[2]}.conversationHistory.history):[];for(const __byok_history of __byok_histories){if(!__byok_history||!Array.isArray(__byok_history.ids))continue;const __byok_start=__byok_history.ids.indexOf(${m[3]});if(__byok_start<0)continue;for(let __byok_i=__byok_start+1;__byok_i<__byok_history.ids.length;__byok_i++){const __byok_item=H(__byok_history,__byok_history.ids[__byok_i])?.item;if(!__byok_item)break;if(qi(__byok_item))break;const __byok_nodes=__byok_item.structured_request_nodes;if(!Array.isArray(__byok_nodes))continue;for(const __byok_node of __byok_nodes){const __byok_result=__byok_node&&__byok_node.type===Ze.TOOL_RESULT?__byok_node.tool_result_node:null;if(!__byok_result||__byok_result.tool_use_id!==${m[4]})continue;const __byok_contentNodes=Array.isArray(__byok_result.content_nodes)?__byok_result.content_nodes:[];return{requestId:${m[3]},toolUseId:${m[4]},phase:__byok_result.is_error?K.error:K.completed,result:{text:typeof __byok_result.content==="string"?__byok_result.content:"",isError:!!__byok_result.is_error,contentNodes:__byok_contentNodes,requestId:typeof __byok_result.request_id==="string"?__byok_result.request_id:void 0}}}break}}}catch{}return{requestId:${m[3]},toolUseId:${m[4]},result:void 0,phase:K.new}}))`,
        "extension-client-context tool use state selector fallback"
      );
      applied.push("tool_state_selector");
    }
    out = ensureMarker(out, MARKER_TOOL_STATE_SELECTOR);
  }

  const didChange = out !== original;
  if (didChange) fs.writeFileSync(filePath, out, "utf8");
  return { changed: didChange, reason: applied.length ? applied.join("+") : "already_patched" };
}

function patchWebviewToolUseFallback(extensionDir) {
  const extDir = path.resolve(String(extensionDir || ""));
  if (!extDir || extDir === path.parse(extDir).root) throw new Error("patchWebviewToolUseFallback: invalid extensionDir");

  const assetsDir = path.join(extDir, "common-webviews", "assets");
  if (!fs.existsSync(assetsDir)) throw new Error(`webview assets dir missing: ${assetsDir}`);

  const selectorCandidates = fs
    .readdirSync(assetsDir)
    .filter((name) => typeof name === "string" && name.startsWith("extension-client-context-") && name.endsWith(".js"))
    .map((name) => path.join(assetsDir, name));

  if (!selectorCandidates.length) throw new Error("extension-client-context asset not found (upstream may have changed)");

  const results = [];
  for (const filePath of selectorCandidates) results.push({ filePath, ...patchExtensionClientContextAsset(filePath) });
  return { changed: results.some((r) => r.changed), results };
}

module.exports = { patchWebviewToolUseFallback };

if (require.main === module) {
  const extensionDir = process.argv[2];
  if (!extensionDir) {
    console.error(`usage: ${path.basename(process.argv[1])} <extensionDir>`);
    process.exit(2);
  }
  patchWebviewToolUseFallback(extensionDir);
}
