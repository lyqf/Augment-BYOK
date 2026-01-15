#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const { ensureMarker } = require("../lib/patch");

const MARKER = "__augment_byok_official_overrides_patched_v1";

function findMatchIndexes(src, re, label) {
  const matches = Array.from(src.matchAll(re));
  if (matches.length === 0) throw new Error(`${label} needle not found (upstream may have changed): matched=0`);
  const indexes = matches.map((m) => m.index).filter((i) => typeof i === "number" && i >= 0);
  if (indexes.length !== matches.length) throw new Error(`${label} needle match missing index`);
  return indexes.sort((a, b) => a - b);
}

function parseParamNames(paramsRaw) {
  const raw = String(paramsRaw || "");
  return raw
    .split(",")
    .map((x) => x.split("=")[0].trim())
    .filter(Boolean);
}

function injectIntoAsyncMethods(src, methodName, buildInjection) {
  const re = new RegExp(`async\\s+${methodName}\\s*\\(([^)]*)\\)`, "g");
  const matches = Array.from(src.matchAll(re));
  if (!matches.length) throw new Error(`${methodName} needle not found (upstream may have changed)`);

  let out = src;
  let patched = 0;
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    const idx = m.index;
    const openBrace = out.indexOf("{", idx);
    if (openBrace < 0) throw new Error(`${methodName} patch: failed to locate method body opening brace`);
    const params = parseParamNames(m[1] || "");
    const injection = String(buildInjection(params) || "");
    if (!injection) continue;
    out = out.slice(0, openBrace + 1) + injection + out.slice(openBrace + 1);
    patched += 1;
  }
  return { out, count: patched };
}

function injectOnceAfterLiteral(src, needle, injection, label) {
  const idx = src.indexOf(needle);
  if (idx < 0) throw new Error(`needle not found: ${label}`);
  const idx2 = src.indexOf(needle, idx + needle.length);
  if (idx2 >= 0) throw new Error(`needle not unique: ${label}`);
  return src.slice(0, idx + needle.length) + injection + src.slice(idx + needle.length);
}

function patchClientAuthGetters(src) {
  const injectApiToken =
    `try{const __byok_off=require("./byok/official").getOfficialConnection();if(__byok_off.apiToken)return __byok_off.apiToken}catch{}` +
    ``;
  const injectCompletionURL =
    `try{const __byok_off=require("./byok/official").getOfficialConnection();if(__byok_off.completionURL)return __byok_off.completionURL}catch{}` +
    ``;

  let out = src;
  out = injectOnceAfterLiteral(out, "async getAPIToken(){", injectApiToken, "clientAuth.getAPIToken");
  out = injectOnceAfterLiteral(out, "async getCompletionURL(){", injectCompletionURL, "clientAuth.getCompletionURL");
  return out;
}

function patchCallApiBaseUrlAndToken(src) {
  const injection = (params) => {
    if (!Array.isArray(params) || params.length < 11) return "";
    const baseUrlParam = params[5];
    const apiTokenParam = params[10];
    if (!baseUrlParam || !apiTokenParam) return "";
    return (
      `try{const __byok_off=require("./byok/official").getOfficialConnection();` +
      `if(!${baseUrlParam}&&__byok_off.completionURL)${baseUrlParam}=__byok_off.completionURL;` +
      `if(!${apiTokenParam}&&__byok_off.apiToken)${apiTokenParam}=__byok_off.apiToken}catch{}` +
      ``
    );
  };
  return injectIntoAsyncMethods(src, "callApi", injection);
}

function patchCallApiStreamCompletionUrlCoalesce(src) {
  const re = /(\b[a-zA-Z_$][\w$]*)=\1\?\?await this\.clientAuth\.getCompletionURL\(\)/g;
  let count = 0;
  const out = src.replace(re, (_m, v) => {
    count += 1;
    return `${v}=${v}||await this.clientAuth.getCompletionURL()`;
  });
  return { out, count };
}

function patchOfficialOverrides(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`missing file: ${filePath}`);
  const original = fs.readFileSync(filePath, "utf8");
  if (original.includes(MARKER)) return { changed: false, reason: "already_patched" };

  let next = original;
  next = patchClientAuthGetters(next);

  const apiRes = patchCallApiBaseUrlAndToken(next);
  next = apiRes.out;

  const streamRes = patchCallApiStreamCompletionUrlCoalesce(next);
  next = streamRes.out;

  next = ensureMarker(next, MARKER);
  fs.writeFileSync(filePath, next, "utf8");
  return { changed: true, reason: "patched", callApiPatched: apiRes.count, callApiStreamCoalescePatched: streamRes.count };
}

module.exports = { patchOfficialOverrides };

if (require.main === module) {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error(`usage: ${path.basename(process.argv[1])} <extension/out/extension.js>`);
    process.exit(2);
  }
  patchOfficialOverrides(filePath);
}

