// Oculta capas emergentes ("overlays") de anuncios que se insertan dinámicamente.
(() => {
  const SUSPICIOUS = /(^|[-_\s])(ad|ads|advert|sponsor|popunder|promo-popup)([-_\s]|$)/i;

  function isAdOverlay(el) {
    if (!(el instanceof HTMLElement)) return false;
    const label = `${el.id} ${typeof el.className === "string" ? el.className : ""}`;
    if (!SUSPICIOUS.test(label)) return false;
    const style = getComputedStyle(el);
    return (style.position === "fixed" || style.position === "absolute") && Number(style.zIndex) > 1000;
  }

  function scan(root) {
    if (isAdOverlay(root)) root.style.setProperty("display", "none", "important");
    root.querySelectorAll?.("[id],[class]").forEach((el) => {
      if (isAdOverlay(el)) el.style.setProperty("display", "none", "important");
    });
  }

  chrome.storage.local.get(["enabled", "allowlist"], ({ enabled = true, allowlist = [] }) => {
    if (!enabled || allowlist.includes(location.hostname)) return;
    new MutationObserver((mutations) => {
      for (const m of mutations) m.addedNodes.forEach((n) => n.nodeType === 1 && scan(n));
    }).observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener("DOMContentLoaded", () => scan(document.documentElement));
  });
})();
