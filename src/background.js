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

// ---------------------------------------------------------------------------
// Bloqueador de ventanas emergentes (pop-ups / pop-unders).
// Una pestaña nueva abierta por una página se cierra si va a otro sitio y el
// usuario no hizo clic justo antes en un enlace hacia ese mismo sitio.
// ---------------------------------------------------------------------------
const CLICK_WINDOW_MS = 2000;
const recentClicks = new Map(); // tabId -> [{ site, time }]
const pendingTabs = new Map();  // tabId -> { sourceTabId, sourceUrl } (aún en about:blank)

function siteOf(url) {
  try {
    const { protocol, hostname } = new URL(url);
    if (!protocol.startsWith("http")) return null;
    // Aproximación del dominio registrable: últimos dos niveles (ej. "google.com").
    return hostname.split(".").slice(-2).join(".");
  } catch {
    return null;
  }
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type !== "userClick" || !sender.tab) return;
  const site = siteOf(msg.href);
  if (!site) return;
  const now = Date.now();
  const list = (recentClicks.get(sender.tab.id) || []).filter((c) => now - c.time < CLICK_WINDOW_MS);
  list.push({ site, time: now });
  recentClicks.set(sender.tab.id, list);
});

chrome.webNavigation.onCreatedNavigationTarget.addListener(async (d) => {
  const source = await chrome.tabs.get(d.sourceTabId).catch(() => null);
  if (!source) return;
  if (siteOf(d.url)) {
    await checkPopup(d.tabId, d.url, d.sourceTabId, source.url);
  } else {
    // window.open() sin URL (about:blank) que luego redirige: decidir en la siguiente navegación.
    pendingTabs.set(d.tabId, { sourceTabId: d.sourceTabId, sourceUrl: source.url });
    setTimeout(() => pendingTabs.delete(d.tabId), 10000);
  }
});

chrome.webNavigation.onBeforeNavigate.addListener(async (d) => {
  const pending = d.frameId === 0 && pendingTabs.get(d.tabId);
  if (!pending || !siteOf(d.url)) return;
  pendingTabs.delete(d.tabId);
  await checkPopup(d.tabId, d.url, pending.sourceTabId, pending.sourceUrl);
});

async function checkPopup(tabId, targetUrl, sourceTabId, sourceUrl) {
  const { enabled = true, allowlist = [] } = await chrome.storage.local.get(["enabled", "allowlist"]);
  const sourceSite = siteOf(sourceUrl);
  if (!enabled || !sourceSite) return;
  if (allowlist.some((d) => siteOf(`https://${d}`) === sourceSite)) return;

  const targetSite = siteOf(targetUrl);
  if (targetSite === sourceSite) return;

  // Ventanas tipo "popup" con tamaño propio (inicio de sesión con Google, pagos…) se permiten.
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab) return;
  const win = await chrome.windows.get(tab.windowId).catch(() => null);
  if (win && win.type === "popup") return;

  // El mensaje del clic puede llegar un instante después del evento de navegación.
  await new Promise((r) => setTimeout(r, 300));
  const clicks = recentClicks.get(sourceTabId) || [];
  if (clicks.some((c) => c.site === targetSite && Date.now() - c.time < CLICK_WINDOW_MS)) return;

  await chrome.tabs.remove(tabId).catch(() => {});
  const { popupsBlocked = 0 } = await chrome.storage.local.get("popupsBlocked");
  await chrome.storage.local.set({ popupsBlocked: popupsBlocked + 1 });
}

chrome.tabs.onRemoved.addListener((tabId) => {
  recentClicks.delete(tabId);
  pendingTabs.delete(tabId);
});
