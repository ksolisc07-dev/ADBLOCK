# Escudo AdBlock

Extensión para Chrome / Edge / Brave (Manifest V3) que bloquea publicidad y reduce el riesgo de virus provenientes de anuncios maliciosos.

## Qué bloquea

- **Anuncios y rastreadores** (`rules/ads.json`): redes publicitarias como DoubleClick, Taboola, Outbrain, Criteo, etc.
- **Malvertising y mineros** (`rules/malware.json`): redes de pop-unders y redirecciones (PopAds, PopCash, PropellerAds, Adsterra…) y scripts de minería de criptomonedas. Estas reglas bloquean también la navegación directa a esos dominios y **permanecen activas aunque pauses el bloqueo de anuncios**.
- **Ventanas emergentes (pop-ups y pop-unders)**: si una página abre una pestaña nueva hacia **otro sitio** sin que hayas hecho clic en un enlace hacia ese sitio, la pestaña se cierra al instante. Los enlaces normales, las pestañas del mismo sitio y las ventanas de inicio de sesión (Google, pagos, etc.) siguen funcionando. Si un sitio de confianza deja de funcionar bien, usa "Permitir anuncios en este sitio".
- **Ocultación cosmética** (`src/cosmetic.css`, `src/content.js`): esconde huecos de anuncios y capas emergentes publicitarias.

El bloqueo usa la API `declarativeNetRequest`, por lo que es rápido y la extensión no lee el contenido de tus peticiones.

## Instalación

1. Descarga o clona este repositorio.
2. Abre `chrome://extensions` (o `edge://extensions`).
3. Activa el **Modo de desarrollador**.
4. Pulsa **Cargar descomprimida** y selecciona la carpeta del proyecto.

## Actualizar

Después de descargar una versión nueva, ve a `chrome://extensions` y pulsa el botón de recargar (flecha circular) de la tarjeta de Escudo AdBlock.

## Uso

Haz clic en el icono del escudo para ver cuántos elementos se bloquearon en la pestaña y cuántas ventanas emergentes se cerraron, pausar el bloqueo de anuncios o permitir anuncios en un sitio concreto. El contador también aparece en el icono.

## Añadir dominios

Agrega una entrada a `rules/ads.json` o `rules/malware.json` con un `id` único dentro del archivo y recarga la extensión:

```json
{ "id": 99, "priority": 1, "action": { "type": "block" },
  "condition": { "urlFilter": "||ejemplo-anuncios.com^", "resourceTypes": ["script", "image", "sub_frame"] } }
```

## Importante

Un bloqueador de anuncios reduce mucho una vía común de infección, pero **no sustituye a un antivirus**. Mantén el navegador y el sistema actualizados y no descargues archivos de sitios en los que no confíes.
