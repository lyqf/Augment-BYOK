#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const { ensureMarker, injectIntoArrowPropertyFunctions } = require("../lib/patch");

const MARKER = "__augment_byok_model_picker_byok_only_v1";

function patchModelPickerByokOnly(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`missing file: ${filePath}`);
  const original = fs.readFileSync(filePath, "utf8");
  if (original.includes(MARKER)) return { changed: false, reason: "already_patched" };

  const injection =
    `try{` +
    `const __byok_state=require("./byok/config/state").state;` +
    `if(__byok_state&&__byok_state.runtimeEnabled){` +
    `return require("./byok/core/model-picker").getMergedAdditionalChatModelsByokOnly({` +
    `modelDisplayNameToId:(this&&this._config&&this._config.config&&this._config.config.chat&&this._config.config.chat.modelDisplayNameToId),` +
    `additionalChatModelsRaw:(this&&this._featureFlagManager&&this._featureFlagManager.currentFlags?this._featureFlagManager.currentFlags.additionalChatModels:""),` +
    `logger:(this&&this._logger)` +
    `});` +
    `}` +
    `}catch{}`;

  const injected = injectIntoArrowPropertyFunctions(original, "getMergedAdditionalChatModels", injection);
  let next = injected.out;

  next = ensureMarker(next, MARKER);
  fs.writeFileSync(filePath, next, "utf8");
  return { changed: true, reason: "patched", patched: injected.count };
}

module.exports = { patchModelPickerByokOnly };

if (require.main === module) {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error(`usage: ${path.basename(process.argv[1])} <extension/out/extension.js>`);
    process.exit(2);
  }
  patchModelPickerByokOnly(filePath);
}
