// Protecciones dentro de la página: oculta capas de anuncios y alertas falsas,
// detecta capas invisibles sobre vídeos y avisa de estafas tipo "ClickFix".
(() => {
  const SUSPICIOUS = /(^|[-_\s])(ad|ads|advert|sponsor|popunder|promo-popup)([-_\s]|$)/i;
  // Textos de alertas falsas que se hacen pasar por el navegador.
  const FAKE_ALERT = /\b(chrome|google|windows|navegador)\s+(alerta|alert|aviso|warning)\b|verifica que no eres un (bot|robot)|verify (that )?you are (not a bot|human)/i;
  // Instrucciones típicas de "ClickFix": pegar un comando en Win+R o PowerShell.
  const CLICKFIX_KEYS = /(windows|win|⊞)\s*(\+|y|and)\s*["“]?r\b/i;
  const CLICKFIX_PASTE = /(ctrl|control)\s*\+\s*v/i;
  const ABUSE_TLD = /\.(cfd|sbs|cyou|icu|buzz|top|click|rest|bond|lol|quest|autos|boats|yachts|hair|makeup|beauty|skin|homes|mom|monster|tk|ml|ga|cf|gq|zip|mov|cam|country|kim|work|surf)$/i;

  const hide = (el) => el.style.setProperty("display", "none", "important");
  const isFloating = (style) => style.position === "fixed" || style.position === "absolute";

  function isAdOverlay(el) {
    if (!(el instanceof HTMLElement)) return false;
    const label = `${el.id} ${typeof el.className === "string" ? el.className : ""}`;
    if (!SUSPICIOUS.test(label)) return false;
    const style = getComputedStyle(el);
    return isFloating(style) && Number(style.zIndex) > 1000;
  }

  // Busca el contenedor flotante de un texto de alerta falsa y lo oculta.
  function hideFakeAlert(el) {
    for (let node = el; node && node !== document.body; node = node.parentElement) {
      if (getComputedStyle(node).position === "fixed") return hide(node);
    }
  }

  function scan(root) {
    if (isAdOverlay(root)) hide(root);
    root.querySelectorAll?.("[id],[class]").forEach((el) => isAdOverlay(el) && hide(el));
    if (FAKE_ALERT.test(root.textContent || "")) {
      root.querySelectorAll?.("*").forEach((el) => {
        if (el.childElementCount === 0 && FAKE_ALERT.test(el.textContent)) hideFakeAlert(el);
      });
    }
  }

  // Enlace "trampa": invisible, o una capa grande que tapa el vídeo o la página.
  function isTrapLink(link) {
    try {
      if (ABUSE_TLD.test(new URL(link.href).hostname)) return true;
    } catch {}
    const viewport = innerWidth * innerHeight;
    for (let node = link, depth = 0; node && depth < 4; node = node.parentElement, depth++) {
      const style = getComputedStyle(node);
      if (Number(style.opacity) < 0.1) return true;
      const rect = node.getBoundingClientRect();
      if (isFloating(style) && rect.width * rect.height > viewport * 0.25) return true;
      if (isFloating(style) && FAKE_ALERT.test(node.textContent || "")) return true;
    }
    return false;
  }

  const siteOf = (origin) => {
    try {
      return new URL(origin).hostname.split(".").slice(-2).join(".");
    } catch {
      return null;
    }
  };
  const ancestors = location.ancestorOrigins || [];
  const topSite = ancestors.length ? siteOf(ancestors[ancestors.length - 1]) : siteOf(location.href);
  const inThirdPartyFrame = window !== top && topSite !== siteOf(location.href);

  // Advertencia a pantalla completa (ClickFix o portapapeles bloqueado).
  let warned = false;
  function showWarning(reason) {
    if (warned) return;
    warned = true;
    chrome.runtime.sendMessage({ type: "threatBlocked" }).catch(() => {});
    const box = document.createElement("div");
    box.setAttribute("style", "all:initial;position:fixed;inset:0;z-index:2147483647;background:rgba(120,0,10,.96);color:#fff;font:18px/1.5 system-ui,sans-serif;display:flex;align-items:center;justify-content:center;padding:24px;");
    box.innerHTML = `<div style="max-width:620px">
      <div style="font-size:30px;font-weight:bold;margin-bottom:12px">⚠️ Página peligrosa</div>
      <p style="margin:0 0 12px"></p>
      <p style="margin:0 0 12px"><b>NO</b> pulses Windows + R, <b>NO</b> pegues nada (Ctrl + V) en Ejecutar, PowerShell ni Terminal.
      Ningún sitio legítimo (ni Cloudflare, ni Google) te pide hacer eso para "verificar que no eres un robot".</p>
      <p style="margin:0 0 20px">Si copiaste algo desde esta página, no lo pegues en ningún sitio. Cierra esta pestaña.</p>
      <button style="font:16px system-ui;padding:10px 18px;border:0;border-radius:6px;cursor:pointer">Cerrar aviso</button>
    </div>`;
    box.querySelector("p").textContent = reason;
    // Intenta sobrescribir un posible comando malicioso que ya esté en el portapapeles.
    navigator.clipboard?.writeText("").catch(() => {});
    box.querySelector("button").onclick = () => box.remove();
    (document.body || document.documentElement).appendChild(box);
  }

  // El guardián del portapapeles (mundo MAIN) avisa con este evento.
  document.addEventListener("escudo-clipboard-blocked", () =>
    showWarning("Esta página intentó copiar a escondidas un comando malicioso en tu portapapeles."));

  let checks = 0;
  function checkClickFix() {
    const text = document.body?.innerText || "";
    if (CLICKFIX_KEYS.test(text) && CLICKFIX_PASTE.test(text)) {
      showWarning("Esta página te pide pulsar Windows + R y pegar un comando: es una estafa para instalar un virus.");
    }
  }

  chrome.storage.local.get(["enabled", "allowlist"], ({ enabled = true, allowlist = [] }) => {
    // La detección de ClickFix es protección contra virus: siempre activa.
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", checkClickFix);
    else checkClickFix();
    const timer = setInterval(() => (++checks > 15 ? clearInterval(timer) : checkClickFix()), 2000);

    if (!enabled || allowlist.includes(location.hostname)) return;

    // Avisa al bloqueador de pop-ups de los enlaces que el usuario pulsa de verdad,
    // para no cerrar las pestañas nuevas que sí quiere abrir.
    const reportClick = (e) => {
      if (!e.isTrusted) return;
      const link = e.target instanceof Element && e.target.closest("a[href]");
      if (!link) return;
      let trusted = !isTrapLink(link);
      // Dentro de un reproductor de vídeo de otro sitio, solo cuentan los enlaces a ese mismo
      // reproductor (p. ej. "Ver en YouTube"); los anuncios enlazan a otros dominios.
      if (trusted && inThirdPartyFrame) trusted = siteOf(link.href) === siteOf(location.href);
      if (trusted) chrome.runtime.sendMessage({ type: "userClick", href: link.href }).catch(() => {});
    };
    document.addEventListener("click", reportClick, true);
    document.addEventListener("auxclick", reportClick, true);

    new MutationObserver((mutations) => {
      for (const m of mutations) m.addedNodes.forEach((n) => n.nodeType === 1 && scan(n));
    }).observe(document.documentElement, { childList: true, subtree: true });
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => scan(document.documentElement));
    else scan(document.documentElement);
  });
})();
