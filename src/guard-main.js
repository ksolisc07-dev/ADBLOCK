// Se ejecuta en el contexto de la propia página (mundo MAIN) para impedir que copie
// a escondidas comandos maliciosos en el portapapeles (estafas "ClickFix" / CAPTCHA falso).
(() => {
  const DANGEROUS = /powershell|pwsh|mshta|cmd(\.exe)?\s+\/[ck]|\biex\b|invoke-(expression|webrequest|restmethod)|\biwr\s|\birm\s|frombase64string|-e(nc(odedcommand)?)?\s+[a-z0-9+/=]{20,}|bitsadmin|certutil|rundll32|regsvr32|wscript|cscript|start-process|curl\s[^\n]*\|\s*(ba|z)?sh|wget\s[^\n]*\|\s*(ba|z)?sh|osascript|base64\s+(-d|--decode)/i;

  const isDangerous = (text) => typeof text === "string" && DANGEROUS.test(text);
  const alarm = () => document.dispatchEvent(new CustomEvent("escudo-clipboard-blocked"));

  const clip = window.Clipboard && Clipboard.prototype;
  if (clip?.writeText) {
    const writeText = clip.writeText;
    clip.writeText = function (text) {
      if (isDangerous(text)) {
        alarm();
        return Promise.resolve();
      }
      return writeText.call(this, text);
    };
  }
  if (clip?.write) {
    const write = clip.write;
    clip.write = async function (items) {
      for (const item of items || []) {
        if (item.types?.includes("text/plain")) {
          const text = await (await item.getType("text/plain")).text();
          if (isDangerous(text)) {
            alarm();
            return;
          }
        }
      }
      return write.call(this, items);
    };
  }

  // Copia mediante el evento "copy" (event.clipboardData.setData).
  const setData = DataTransfer.prototype.setData;
  DataTransfer.prototype.setData = function (format, data) {
    if (isDangerous(data)) {
      alarm();
      return;
    }
    return setData.call(this, format, data);
  };

  // Copia mediante un campo de texto oculto + document.execCommand("copy").
  const execCommand = Document.prototype.execCommand;
  Document.prototype.execCommand = function (command, ...rest) {
    if (String(command).toLowerCase() === "copy") {
      const active = document.activeElement;
      const selected = String(window.getSelection?.() || "") ||
        (active && "value" in active ? String(active.value).slice(active.selectionStart, active.selectionEnd) : "");
      if (isDangerous(selected)) {
        alarm();
        return false;
      }
    }
    return execCommand.call(this, command, ...rest);
  };
})();
