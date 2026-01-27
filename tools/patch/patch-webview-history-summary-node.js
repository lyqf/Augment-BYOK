#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const { ensureMarker } = require("../lib/patch");

const MARKER = "__augment_byok_webview_history_summary_node_slim_v1";

function replaceOnce(src, needle, replacement, label) {
  const s = String(src || "");
  const n = String(needle || "");
  const r = String(replacement ?? "");
  const idx = s.indexOf(n);
  if (idx < 0) throw new Error(`${label} needle not found (upstream may have changed)`);
  if (s.indexOf(n, idx + n.length) >= 0) throw new Error(`${label} needle matched multiple times (refuse to patch)`);
  return s.replace(n, r);
}

function patchExtensionClientContextAsset(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`missing file: ${filePath}`);
  const original = fs.readFileSync(filePath, "utf8");
  if (original.includes(MARKER)) return { changed: false, reason: "already_patched" };

  // 上游 useHistorySummaryNew 会把 {history_end: tail exchanges(with nodes)} 存进 request_nodes 的 HISTORY_SUMMARY 节点。
  // 该节点体积巨大，后续“Editable History / 编辑历史对话”等路径可能对 request_nodes 做 JSON.stringify/clone，导致内存爆炸→VSIX 崩溃。
  //
  // 修复策略：仍然生成同样的 summary payload（C），但存入 state 的节点改为 TEXT，并把 message_template 填充后的字符串写入 text_node.content。
  // 这样：语义保持（模型仍拿到同样的 supervisor prompt），同时避免把 history_end 的巨型结构长期挂在 state 上。
  let out = original;

  const needle =
    'if(n.useHistorySummaryNew){const C={summary_text:F.responseText,summarization_request_id:F.requestId,history_beginning_dropped_num_exchanges:V,history_middle_abridged_text:X,history_end:c,message_template:n.summaryNodeRequestMessageTemplateNew},U={id:0,type:Ce.HISTORY_SUMMARY,history_summary_node:C};console.info("Storing HISTORY_SUMMARY node for next exchange"),yield*E(rS(t,U))}';

  const replacement =
    'if(n.useHistorySummaryNew){const C={summary_text:F.responseText,summarization_request_id:F.requestId,history_beginning_dropped_num_exchanges:V,history_middle_abridged_text:X,history_end:c,message_template:n.summaryNodeRequestMessageTemplateNew},U={id:0,type:Ce.TEXT,text_node:{content:V5(C)}};console.info("Storing HISTORY_SUMMARY node for next exchange"),yield*E(rS(t,U))}';

  out = replaceOnce(out, needle, replacement, "extension-client-context HISTORY_SUMMARY node slimming");

  out = ensureMarker(out, MARKER);
  fs.writeFileSync(filePath, out, "utf8");
  return { changed: true, reason: "patched" };
}

function patchWebviewHistorySummaryNode(extensionDir) {
  const extDir = path.resolve(String(extensionDir || ""));
  if (!extDir || extDir === path.parse(extDir).root) throw new Error("patchWebviewHistorySummaryNode: invalid extensionDir");

  const assetsDir = path.join(extDir, "common-webviews", "assets");
  if (!fs.existsSync(assetsDir)) throw new Error(`webview assets dir missing: ${assetsDir}`);

  const candidates = fs
    .readdirSync(assetsDir)
    .filter((name) => typeof name === "string" && name.startsWith("extension-client-context-") && name.endsWith(".js"))
    .map((name) => path.join(assetsDir, name));

  if (!candidates.length) throw new Error("extension-client-context asset not found (upstream may have changed)");

  const results = [];
  for (const filePath of candidates) results.push({ filePath, ...patchExtensionClientContextAsset(filePath) });
  return { changed: results.some((r) => r.changed), results };
}

module.exports = { patchWebviewHistorySummaryNode };

if (require.main === module) {
  const extensionDir = process.argv[2];
  if (!extensionDir) {
    console.error(`usage: ${path.basename(process.argv[1])} <extensionDir>`);
    process.exit(2);
  }
  patchWebviewHistorySummaryNode(extensionDir);
}
