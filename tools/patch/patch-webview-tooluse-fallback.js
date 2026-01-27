#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const { ensureMarker } = require("../lib/patch");

const MARKER = "__augment_byok_webview_tooluse_fallback_v1";

function replaceOnce(src, needle, replacement, label) {
  const s = String(src || "");
  const n = String(needle || "");
  const r = String(replacement ?? "");
  const idx = s.indexOf(n);
  if (idx < 0) throw new Error(`${label} needle not found (upstream may have changed)`);
  if (s.indexOf(n, idx + n.length) >= 0) throw new Error(`${label} needle matched multiple times (refuse to patch)`);
  return s.replace(n, r);
}

function patchAugmentMessageAsset(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`missing file: ${filePath}`);
  const original = fs.readFileSync(filePath, "utf8");
  if (original.includes(MARKER)) return { changed: false, reason: "already_patched" };

  let out = original;

  // 1) $displayableToolUseNodes 在重启后可能为空（store 未恢复），但 turn.structured_output_nodes 仍包含 TOOL_USE。
  //    兜底：优先用 store 的 displayable nodes；为空时回退到 t.toolUseNodes。
  out = replaceOnce(
    out,
    "const L=r((()=>i().filter((m=>!!m.tool_use))));",
    "const L=r((()=>{const m=i();const E=Array.isArray(m)?m.filter((C=>!!C.tool_use)):[];return E.length?E:t.toolUseNodes.filter((C=>!!C.tool_use))}));",
    "AugmentMessage tool list nodes fallback"
  );

  // 2) 基于真实渲染列表（L）决定单卡片/分组视图，避免 store 为空时直接不渲染。
  out = replaceOnce(out, "i().length===1?P(N):P(O,!1)", "e(L).length===1?P(N):P(O,!1)", "AugmentMessage tool list layout");
  out = replaceOnce(out, "i()?.length&&m($)", "e(L).length&&m($)", "AugmentMessage tool list render gate");

  out = ensureMarker(out, MARKER);
  fs.writeFileSync(filePath, out, "utf8");
  return { changed: true, reason: "patched" };
}

function patchWebviewToolUseFallback(extensionDir) {
  const extDir = path.resolve(String(extensionDir || ""));
  if (!extDir || extDir === path.parse(extDir).root) throw new Error("patchWebviewToolUseFallback: invalid extensionDir");

  const assetsDir = path.join(extDir, "common-webviews", "assets");
  if (!fs.existsSync(assetsDir)) throw new Error(`webview assets dir missing: ${assetsDir}`);

  const candidates = fs
    .readdirSync(assetsDir)
    .filter((name) => typeof name === "string" && name.startsWith("AugmentMessage-") && name.endsWith(".js"))
    .map((name) => path.join(assetsDir, name));

  if (!candidates.length) throw new Error("AugmentMessage asset not found (upstream may have changed)");

  const results = [];
  for (const filePath of candidates) results.push({ filePath, ...patchAugmentMessageAsset(filePath) });
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
