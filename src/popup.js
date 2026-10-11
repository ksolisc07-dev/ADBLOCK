const $ = (id) => document.getElementById(id);

(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let domain = null;
  try {
    const url = new URL(tab.url);
    if (url.protocol.startsWith("http")) domain = url.hostname;
  } catch {}

  const render = ({ enabled, allowlist }) => {
    $("enabled").checked = enabled;
    $("site").disabled = !domain || !enabled;
    $("site").textContent = domain && allowlist.includes(domain)
      ? "Volver a bloquear en este sitio"
      : "Permitir anuncios en este sitio";
  };

  render(await chrome.runtime.sendMessage({ type: "getState" }));
  const { popupsBlocked = 0, threatsBlocked = 0 } = await chrome.storage.local.get(["popupsBlocked", "threatsBlocked"]);
  $("popups").textContent = popupsBlocked;
  $("threats").textContent = threatsBlocked;

  try {
    const { rulesMatchedInfo } = await chrome.declarativeNetRequest.getMatchedRules({ tabId: tab.id });
    $("count").textContent = rulesMatchedInfo.length;
  } catch {}

  $("enabled").addEventListener("change", async (e) => {
    render(await chrome.runtime.sendMessage({ type: "setEnabled", enabled: e.target.checked }));
    chrome.tabs.reload(tab.id);
  });
  $("site").addEventListener("click", async () => {
    render(await chrome.runtime.sendMessage({ type: "toggleSite", domain }));
    chrome.tabs.reload(tab.id);
  });
})();
