"use strict";

const { ensureConfigManager } = require("./state");
const { normalizeString } = require("./util");

const DEFAULT_OFFICIAL_COMPLETION_URL_ENV = "AUGMENT_BYOK_OFFICIAL_COMPLETION_URL";
const DEFAULT_OFFICIAL_API_TOKEN_ENV = "AUGMENT_BYOK_OFFICIAL_API_TOKEN";

function normalizeBaseUrl(url) {
  const s = normalizeString(url);
  if (!s) return "";
  try {
    const u = new URL(s);
    if (!u.pathname.endsWith("/")) u.pathname = u.pathname + "/";
    return u.toString();
  } catch {
    return s.endsWith("/") ? s : s + "/";
  }
}

function readEnv(name) {
  const k = normalizeString(name);
  if (!k) return "";
  return normalizeString(process.env[k]);
}

function getOfficialConnection() {
  const cfg = ensureConfigManager().get();
  const off = cfg?.official && typeof cfg.official === "object" ? cfg.official : {};

  const completionUrlEnv = normalizeString(off.completionUrlEnv) || DEFAULT_OFFICIAL_COMPLETION_URL_ENV;
  const apiTokenEnv = normalizeString(off.apiTokenEnv) || DEFAULT_OFFICIAL_API_TOKEN_ENV;

  const completionURL = normalizeBaseUrl(readEnv(completionUrlEnv) || normalizeString(off.completionUrl));
  const apiToken = normalizeString(readEnv(apiTokenEnv)).toUpperCase();

  return { completionURL, apiToken };
}

module.exports = { getOfficialConnection, DEFAULT_OFFICIAL_COMPLETION_URL_ENV, DEFAULT_OFFICIAL_API_TOKEN_ENV };

