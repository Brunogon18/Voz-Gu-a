# Proceso real de construcción de Voz Guía

Reconstruido el 26/11/2026 a partir de evidencia en disco, no de memoria.

## Fuentes usadas

| Fuente | Ruta | Qué aporta |
|---|---|---|
| Historial de prompts | `C:\Users\brits\.gemini\antigravity-cli\history.jsonl` | 5 entradas con hora exacta |
| Conversación completa | `C:\Users\brits\.gemini\antigravity-cli\conversations\778aedbd-7883-4fff-adaa-e395656cb6e2.db` | 198 pasos (protobuf), 2 cascadas |
| Artefactos | `C:\Users\brits\Voz Guia` | archivos y fechas de modificación |
| Verificación | `npx tsc --noEmit`, `npm test` | ejecutados hoy: 0 errores, 4/4 pruebas |

## Cronología

| Hora | Hecho | Evidencia |
|---|---|---|
| 10:56 | Se descarga el instalador `android-studio-rabbit2-patch2-windows.exe` | `Downloads`, 1.53 GB |
| 11:00 | Se instala Android Studio (nunca se abre el asistente) | `C:\Program Files\Android\Android Studio`, creación 11:00:32 |
| 11:12:31 | Primera pregunta a agy: si hace falta API key de AI Studio | `history.jsonl` |
| 11:12–11:14 | agy lee su propia documentación y responde: no hace falta key; se configura local | pasos 1–11 del DB |
| 11:14:31 | Se entrega **la especificación completa** y se pide "con TypeScript" | `history.jsonl` |
| 11:16–11:18 | Chequeo de entorno: Node 24.22.1, npm 11.19.1, Java 17, `ANDROID_HOME` vacío, sin SDK | pasos 13–31 |
| 11:18:46 | "ya tengo android studio instalado" → agy verifica que el primer arranque no ocurrió | `history.jsonl`, pasos 18–27 |
| 11:19 | `npx create-expo-app@latest . --template blank-typescript` | `App.tsx`, `app.json`, `index.ts` 11:19:01 |
| 11:20–11:22 | Instalación de `expo-speech`, `expo-sqlite`, `expo-router`, iconos y safe-area | `node_modules` 11:22:05 |
| 11:22–11:28 | Núcleo: tipos, catálogo (15 KB), búsqueda vectorial, router de flooding, SQLite, kvStore, puente nativo, Gemini, TTS, mesh | `src/` 11:28 |
| 11:28:09 | Se entregan las **4 plantillas exportadas de Google Stitch** | `history.jsonl` |
| 11:29–11:32 | Pantallas (Inicio, Trámites, Mesh), componentes y pruebas; `expo prebuild` genera `android/` | `android/` 11:30:31, src 11:29 |
| 11:33–11:35 | Módulos nativos Java (BLE y voz) y registro en `MainApplication.kt`; se corrige el pipeline de pruebas | archivos 11:33–11:35 |
| 11:35–11:44 | Intento de instalar SDK/platform-tools/NDK: `dl.google.com` no responde desde esa red (timeouts, IPv4, `--resolve`, hosts alternos) | pasos 96–197 |
| 11:44 | Verificación independiente: typecheck limpio y 4/4 pruebas en verde | `tsc`, `npm test` |

Duración efectiva del agente: **~32 minutos** (11:12 → 11:44). Sin commits: `git`
no está instalado en el equipo, así que no hay historial de versiones.

## Cómo se generó cada capa

1. **Especificación (humano).** Documento de Voz Guía: problema, ODS, módulos,
   stack propuesto y manual de usuario.
2. **Diseño (humano + Google Stitch).** Se describió el proyecto a Stitch, se
   generaron 4 pantallas y se exportaron como HTML/Tailwind.
3. **Código (agy).** Tradujo especificación y plantillas a Expo/TypeScript y
   escribió los módulos nativos Java.
4. **Verificación (agy + revisión).** `tsc` y `node --test`; hoy se repitieron y
   pasan.

## Qué está realmente hecho

- Proyecto Expo operativo, typecheck limpio, 4 pruebas en verde.
- Catálogo local de trámites con búsqueda por similitud sin internet.
- TTS en español y fallback offline cuando Gemini falla o no hay key.
- Router de *flooding* controlado con TTL y deduplicación (probado).
- Módulos nativos registrados: `VozGuiaMesh` y `VozGuiaSpeech`.

## Qué está a medias (corrección importante)

- **BLE solo descubre.** `VozGuiaMeshModule` anuncia el `nodeId` y escanea por el
  UUID `FEAA`, pero `broadcastPacket()` no envía nada: valida TTL, deduplica y
  devuelve `isRunning`. Los paquetes no viajan por radio; el salto de 2 nodos se
  simula en `meshService.ts`.
- **La UI no usa las plantillas de Stitch.** No hay fuente Atkinson, ni pestañas
  Conversación/Historial, ni Tablón de Avisos, ni la paleta `#002e39/#006a60`.
- **El agente no toma la iniciativa.** La pantalla pregunta "¿Qué trámite
  necesitas hoy?" y espera texto o dictado.
- **Sin APK.** No hay SDK; `android/local.properties` apunta a una ruta
  inexistente.
- **`android/` es generado.** Los módulos Java viven dentro de `android/`, que
  `expo prebuild --clean` borra.

## Riesgos para el jurado

1. Si preguntan "¿cómo funciona el mesh?", la respuesta honesta es: descubrimiento
   BLE real + relay simulado. No afirmar transporte de paquetes.
2. Si piden demo sin internet, el flujo local funciona; el mesh entre teléfonos
   no está demostrable todavía.
3. Si piden el APK, no existe.
4. La llave de Gemini se captura en Ajustes y se guarda en el dispositivo; no hay
   proxy.

## Declaración sugerida (una línea)

"Especificación y diseño de producto: equipo. Interfaz: Google Stitch a partir de
nuestro brief. Implementación: asistida por agente de IA (Antigravity), revisada y
verificada por el equipo. El transporte BLE de paquetes está simulado; el
descubrimiento es real."
