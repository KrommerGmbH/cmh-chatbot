#!/usr/bin/env node

const DEFAULTS = {
  llmPort: 18080,
  enginePort: 14000,
  uiPort: 15200,
};

function parsePort(raw, fallback, name) {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n) || n < 1 || n > 65535) {
    throw new Error(`[dev] invalid ${name}: ${raw}`);
  }
  return n;
}

function getDevPorts() {
  return {
    llmPort: parsePort(process.env.CMH_LLM_PORT, DEFAULTS.llmPort, 'CMH_LLM_PORT'),
    enginePort: parsePort(process.env.CMH_ENGINE_PORT, DEFAULTS.enginePort, 'CMH_ENGINE_PORT'),
    uiPort: parsePort(process.env.CMH_UI_PORT, DEFAULTS.uiPort, 'CMH_UI_PORT'),
  };
}

module.exports = {
  DEFAULTS,
  getDevPorts,
};
