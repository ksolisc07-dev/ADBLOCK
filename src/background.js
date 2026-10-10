// Service worker: activa/desactiva el bloqueo y gestiona la lista de sitios permitidos.
const RULESETS = ["ads", "malware"];
const ALLOW_RULE_BASE = 100000; // ids de reglas dinámicas para sitios permitidos

chrome.runtime.onInstalled.addListener(async () => {
  const { enabled = true, allowlist = [] } = await chrome.storage.local.get(["enabled", "allowlist"]);
  await chrome.storage.local.set({ enabled, allowlist });
  await chrome.declarativeNetRequest.setExtensionActionOptions({ displayActionCountAsBadgeText: true });
  await applyState(enabled, allowlist);
});

async function applyState(enabled, allowlist) {
  // El ruleset "malware" se mantiene siempre activo: protege aunque se pause el bloqueo de anuncios.
  await chrome.declarativeNetRequest.updateEnabledRulesets(
    enabled ? { enableRulesetIds: RULESETS } : { disableRulesetIds: ["ads"], enableRulesetIds: ["malware"] }
  );

  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map((r) => r.id),
    addRules: allowlist.map((domain, i) => ({
      id: ALLOW_RULE_BASE + i,
      priority: 2,
      action: { type: "allowAllRequests" },
      condition: { requestDomains: [domain], resourceTypes: ["main_frame", "sub_frame"] }
    }))
  });
  await chrome.action.setBadgeBackgroundColor({ color: enabled ? "#c81e28" : "#777777" });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    const state = await chrome.storage.local.get(["enabled", "allowlist"]);
    let { enabled = true, allowlist = [] } = state;

    if (msg.type === "setEnabled") enabled = msg.enabled;
    if (msg.type === "toggleSite" && msg.domain) {
      allowlist = allowlist.includes(msg.domain)
        ? allowlist.filter((d) => d !== msg.domain)
        : [...allowlist, msg.domain];
    }
    if (msg.type !== "getState") {
      await chrome.storage.local.set({ enabled, allowlist });
      await applyState(enabled, allowlist);
    }
    sendResponse({ enabled, allowlist });
  })();
  return true; // respuesta asíncrona
});
