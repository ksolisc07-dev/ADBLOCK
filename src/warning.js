const target = location.hash.slice(1);
let host = "";
try {
  host = new URL(target).hostname;
} catch {}

document.getElementById("host").textContent = host || target;
document.getElementById("tld").textContent = "." + host.split(".").pop();
chrome.runtime.sendMessage({ type: "threatBlocked" });

document.getElementById("back").addEventListener("click", async () => {
  // Si la pestaña se abrió sola (ventana emergente), se cierra; si no, vuelve atrás.
  if (history.length > 1) return history.back();
  const tab = await chrome.tabs.getCurrent();
  chrome.tabs.remove(tab.id);
});

document.getElementById("continue").addEventListener("click", async () => {
  if (!host) return;
  if (!confirm(`¿Seguro que quieres abrir ${host}? No descargues nada ni pegues comandos que te pida.`)) return;
  await chrome.runtime.sendMessage({ type: "allowOnce", host });
  location.href = target;
});
