# Prompt para agy — auditoría por partes

Pegar tal cual en agy, dentro de `C:\Users\brits\Voz Guia`.
No pide código: pide un informe verificable del estado real, en 3 entregas.

---

Actúa como ingeniero de documentación técnica. Trabajas sobre el repositorio
`C:\Users\brits\Voz Guia` (Expo SDK 58 + React Native 0.88 + TypeScript 6, con
módulos nativos Java dentro de `android/`).

**TAREA:** auditar el estado real del proyecto y entregar un informe en Markdown,
en 3 PARTES separadas. **No escribas código ni modifiques archivos.** Solo lee,
ejecuta verificaciones y documenta.

## Reglas de verdad

1. Antes de empezar ejecuta `npx tsc --noEmit` y `npm test`, y pega la salida
   como evidencia inicial.
2. Cada afirmación debe citar evidencia: `ruta:línea`, o el comando ejecutado
   con su salida.
3. Etiqueta cada punto: `[VERIFICADO]`, `[INFERIDO]`, `[PENDIENTE]` o
   `[NO VERIFICABLE]`.
4. Si algo está simulado, incompleto o no se puede compilar, dilo sin suavizarlo.
5. No inventes pruebas, versiones ni funcionalidades. Si no lo ejecutaste,
   escribe "no ejecutado".
6. Sin adjetivos ("robusto", "completo", "profesional"); solo hechos.
7. Español neutro, tablas y viñetas cortas.

## PARTE 1 — Inventario (máximo 1 página)

1. Ficha del proyecto: versiones reales de `package.json`, comando de arranque,
   comando de build, requisito de SDK y si el SDK está disponible.
2. Árbol de archivos propios (excluye `node_modules/` y lo generado por
   `prebuild`) con una línea de propósito por archivo.
3. Pantallas y rutas existentes, comparadas contra las 4 plantillas de Stitch
   (Inicio, Conversación, Historial, Tablón de Avisos).
4. Dependencias: cuáles están instaladas y cuáles faltan para cerrar el flujo.

## PARTE 2 — Estado funcional (máximo 2 páginas)

Tabla por módulo con columnas:
`módulo | archivo | estado (funciona / parcial / simulado / ausente) | evidencia | riesgo`.

Cubre obligatoriamente: arranque, catálogo de trámites, SQLite + búsqueda
vectorial, TTS, STT, Gemini, fallback offline, BLE discovery, BLE transporte de
paquetes, flooding/TTL, permisos, UI y build.

Para cada módulo `parcial` o `simulado`, describe exactamente qué falta:
función, línea y API de Android/Expo que se necesita.

Cierra con el flujo real de un toque a voz, en 6 pasos, con `archivo:línea` de
cada salto, y marca dónde se pierde el hilo.

## PARTE 3 — Riesgos y plan (máximo 1 página)

1. Bloqueadores para generar un APK hoy, en orden.
2. Riesgos de demo: qué falla en modo avión, qué exige 2 teléfonos, qué exige red.
3. Deuda técnica priorizada P0/P1/P2 con esfuerzo estimado (30/60/90 min).
4. Plan de 3 bloques de 90 minutos, cada uno con criterio de "hecho" verificable.
5. Anexo de transparencia: qué generó la IA, qué decidió el equipo humano, qué
   plantillas son externas (Google Stitch) y qué quedó simulado. Declarar, no
   justificar.
6. Diez preguntas que un jurado podría hacer y la respuesta correcta basada en
   el código.

## Formato de entrega

Envía la PARTE 1 y espera mi "continúa". Luego la PARTE 2. Luego la PARTE 3.
No mezcles partes ni adelantes contenido de la siguiente.
