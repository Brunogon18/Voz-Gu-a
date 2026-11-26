# Plantillas de Google Stitch

Exportadas por el equipo desde Google Stitch el 26/11/2026 y entregadas al
agente que construyó la app. Son **diseño propio** generado a partir del brief
del proyecto, no una app de terceros.

| Archivo | Pantalla | Tipo de shell |
|---|---|---|
| `01_inicio.html` | Inicio | `mobile_tab` |
| `02_tablon-avisos.html` | Tablón de Avisos (drawer) | `mobile_stack` |
| `03_conversacion.html` | Conversación | `mobile_tab` |
| `04_historial.html` | Historial de Trámites | `mobile_tab` |

## Cómo verlas

Abre el archivo en el navegador. Usan **Tailwind por CDN** y **Material
Symbols**, así que necesitan internet para verse completas.

## Importante

Son **referencia visual estática**: los botones y transiciones están simulados
con JavaScript de demo. No son código para integrar directamente en React
Native; hay que traducir la estructura a componentes.

Tokens y medidas extraídos: `docs/auditoria/PLANTILLAS_STITCH.md`.

## Estado actual en la app

La app **no** usa estas plantillas todavía: tiene otra paleta (verde `#0B5D4B`)
y otras pestañas (Inicio / Trámites / Mesh). La brecha concreta está en
`docs/auditoria/PLANTILLAS_STITCH.md` § "Mapa contra el código actual".
