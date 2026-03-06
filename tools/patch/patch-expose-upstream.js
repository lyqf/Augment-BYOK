#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const { findFirstInstantiationOfExportedClass } = require("../lib/patch");

const MARKER = "__augment_byok_expose_upstream_v1";

function patchExposeUpstream(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`missing file: ${filePath}`);
  const original = fs.readFileSync(filePath, "utf8");
  if (original.includes(MARKER)) return { changed: false, reason: "already_patched" };

  const { classIdent, varName, terminatorIdx } = findFirstInstantiationOfExportedClass(original, "AugmentExtension");

  const injection =
    `;try{` +
    `globalThis.__augment_byok_upstream=globalThis.__augment_byok_upstream||{};` +
    `globalThis.__augment_byok_upstream.augmentExtension=${varName};` +
    `globalThis.__augment_byok_upstream.officialChatDelegation=${varName};` +
    `globalThis.__augment_byok_upstream.capturedAtMs=Date.now();` +
    `if(${varName}&&typeof ${varName}.callApi==="function")globalThis.__augment_byok_upstream.callApiOriginal=${varName}.callApi.bind(${varName});` +
    `if(${varName}&&typeof ${varName}.callApiStream==="function")globalThis.__augment_byok_upstream.callApiStreamOriginal=${varName}.callApiStream.bind(${varName});` +
    `const __tm=(${varName}&&(${varName}._toolsModel||${varName}.toolsModel||${varName}.tools_model));` +
    `if(__tm&&typeof __tm.getToolDefinitions==="function"&&typeof __tm.callTool==="function")globalThis.__augment_byok_upstream.toolsModel=__tm;` +
    `}catch{}` +
    `;/*${MARKER}*/`;

  const next = original.slice(0, terminatorIdx + 1) + injection + original.slice(terminatorIdx + 1);
  fs.writeFileSync(filePath, next, "utf8");
  return { changed: true, reason: "patched", classIdent, varName };
}

module.exports = { patchExposeUpstream };

if (require.main === module) {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error(`usage: ${path.basename(process.argv[1])} <extension/out/extension.js>`);
    process.exit(2);
  }
  patchExposeUpstream(filePath);
}
