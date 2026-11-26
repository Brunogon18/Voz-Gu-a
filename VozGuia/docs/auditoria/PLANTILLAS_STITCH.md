# Plantillas de Google Stitch — sistema y mapa de implementación

Origen: el equipo describió Voz Guía en Stitch, generó 4 pantallas y las exportó
como HTML/Tailwind. Se entregaron a agy el 26/11 a las 11:28. **No se aplicaron
al código**: la app actual usa otra paleta y otras pestañas.

## Sistema de diseño (extraído del HTML)

**Tipografía:** `Atkinson Hyperlegible Next` (elegida por legibilidad).
Alternativa instalable: `@expo-google-fonts/atkinson-hyperlegible`.

| Rol | Tamaño / línea | Peso |
|---|---|---|
| headline-lg-mobile | 28 / 36 | 700 |
| headline-md | 24 / 32 | 700 |
| headline-sm | 20 / 28 | 700 |
| body-lg | 18 / 28 | 400 |
| body-md | 16 / 24 | 400 |
| label-lg | 18 / 24 | 700 |
| label-md | 16 / 20 | 700 |
| label-sm | 14 / 18 | 700 |

**Color**

| Token | Hex | Uso |
|---|---|---|
| primary | `#002E39` | botón principal, títulos |
| on-primary | `#FFFFFF` | texto sobre primario |
| primary-container | `#144552` | hover del primario |
| primary-fixed | `#BCEAFA` | chips informativos |
| secondary | `#006A60` | estado mesh / escucha |
| secondary-container | `#8CF5E4` | píldoras "Mesh activo" |
| tertiary-fixed | `#FFDAD2` | categoría Becas |
| surface | `#FAF9F6` | fondo |
| surface-container-lowest | `#FFFFFF` | tarjetas |
| surface-container | `#EFEEEB` | fondos secundarios |
| on-surface | `#1A1C1A` | texto |
| on-surface-variant | `#41484B` | texto secundario |
| outline-variant | `#C0C8CB` | bordes |
| error | `#BA1A1A` | urgencia |

**Medidas:** margen lateral 20 px (`1.25rem`), gutter 16, radios 8/12/full,
botones mínimos 56 px de alto, nav inferior 80 px, micrófono 144 px.

## Las 4 pantallas

### 1. Inicio (`mobile_tab`)
- Header: campana con punto rojo, título "Inicio", píldora "Mesh activo", avatar.
- Píldora: "Funcionando sin internet vía Red Mesh BLE" con punto pulsante.
- Título: "¿En qué trámite te ayudo hoy?" + "Toca el micrófono para hablar o elige
  una categoría".
- Micrófono 144 px con dos ondas (`animate-ping` al escuchar) y etiqueta
  "Toca para hablar" → "Escuchando...".
- Estado en vivo: pastilla con ecualizador "Escuchando tu voz...".
- "Categorías rápidas": 3 tarjetas (Salud/Citas médicas, Educación/Escuelas y
  constancias, Becas/Convocatorias), icono 56×56, chevron.
- "¿Prefieres escribir?" + input 48 px + botón enviar.
- Banner de retroalimentación al elegir categoría o enviar.
- Nav: Inicio · Conversación · Historial.

### 2. Tablón de Avisos (`mobile_stack`, drawer)
- Drawer izquierdo 90 % / máx. 380 px con scrim al 60 %.
- Header con icono `campaign` y botón cerrar 48 px.
- Banner mesh: "Red Mesh BLE activa" + contador "3 nodos".
- 3 avisos: Becas (09:40, "Recibido vía Red Mesh", botón "Escuchar aviso"),
  Salud (ayer, jornada de vacunación), Red Mesh (3 nodos, "Conectado y al día").
- Footer: "Leer todos los avisos" con micrófono.

### 3. Conversación (`mobile_tab`)
- Barra de estado "Voz Guía lista para escucharte · Audio activo".
- Burbuja del usuario a la derecha ("Quiero saber cómo pedir una beca").
- Burbuja del agente: cabecera con avatar `support_agent`, botón "Escuchar
  respuesta", párrafo empático y pasos numerados 1–3 en tarjetas.
- Respuestas rápidas: "Repite por favor", "Explícalo más sencillo".
- Input + enviar + botón grande "Toca para responder por voz".
- Nav con Conversación activa.

### 4. Historial (`mobile_tab`)
- Título "Historial de Trámites" + insignia "Guardado en tu teléfono para consulta
  sin internet".
- Chips de filtro: Todos (3), Becas, Salud, Educación.
- 3 tarjetas: Beca de Manutención (Completado, "Ver resumen"), Cita médica
  (En progreso, "Continuar"), Constancia de estudios (Completado, "Ver resumen").
- Modal accesible con título, detalle y "Entendido".

## Mapa contra el código actual

| Plantilla | Archivo actual | Estado |
|---|---|---|
| Inicio | `src/app/(tabs)/index.tsx` | Parcial: mismo concepto, otra paleta y métricas |
| Conversación | — | **Ausente** |
| Historial | `src/app/(tabs)/tramites.tsx` | Parcial: lista, sin estados ni modal |
| Tablón de Avisos | — | **Ausente** |
| Nav 3 pestañas | `src/app/(tabs)/_layout.tsx` | Distinto: Inicio / Trámites / Mesh |
| Ajustes (key, hops, rate) | `src/app/(tabs)/mesh.tsx` | Existe, pero no está en la plantilla |

## Qué falta para igualar las plantillas

1. Instalar `@expo-google-fonts/atkinson-hyperlegible` + `expo-font` y cargar en
   `src/app/_layout.tsx`.
2. Crear `src/theme/tokens.ts` con la tabla de color, tipografía y espaciado; no
   repetir hex en cada pantalla.
3. Renombrar/crear rutas: `index` (Inicio), `conversation`, `history`; mover
   Ajustes/Mesh a un modal o a `settings`.
4. Construir el drawer del Tablón de Avisos (Modal transparente + panel 90 %).
5. Extraer de `StepGuideCard.tsx` la burbuja de agente con botón "Escuchar
   respuesta" y las respuestas rápidas.
6. Añadir estados `Completado` / `En progreso` al historial y persistirlos en
   SQLite.
7. Sustituir los ejemplos rápidos por las 3 tarjetas de categoría con iconos.

## Nota de honestidad

Las plantillas son diseño propio del equipo (brief → Stitch). No son código de
terceros ni una app copiada; sirven como referencia visual. Conviene declararlo
así en la entrega y conservar el HTML exportado en `docs/stitch/`.
