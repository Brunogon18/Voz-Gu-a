# HANDOFF — Voz Guía

Documento de traspaso. Escrito el **26 de noviembre de 2026** por el equipo
Deep Code (Campus Coyoacán) para que otra persona o agente continúe el proyecto.

---

## 1. Qué es el proyecto

App Android de acompañamiento por voz para trámites de **salud, educación y
becas**, dirigida a adultos mayores, estudiantes y comunidades con conectividad
limitada. Tres principios:

1. **Voz primero.** El usuario toca un botón y escucha; no necesita leer menús.
2. **Offline real.** Catálogo y búsqueda viven en el teléfono. La IA es opcional.
3. **Red de vecindad (mesh BLE).** La información puede viajar entre teléfonos
   cercanos. *Hoy solo está resuelto el descubrimiento, no el transporte.*

## 2. Estado verificado

Verificado en esta máquina antes de exportar:

```
npx tsc --noEmit   → 0 errores
npm test           → 4 pruebas, 4 pasan, 0 fallan (~120 ms)
```

Stack real (`package.json`): Expo `~58.1.0`, React Native `0.88.1`, React
`19.3.0`, TypeScript `~6.0.3`, expo-router `~58.0.33`, expo-sqlite `~58.0.18`,
expo-speech `~58.0.4`.

| Área | Estado | Evidencia |
|---|---|---|
| Catálogo local (7 trámites: 3 salud, 2 becas, 2 educación) | Funciona | `src/data/tramitesCatalog.ts` |
| Búsqueda por similitud sin internet | Funciona | pruebas 1 y 2 |
| TTS en español | Funciona | `src/services/voiceService.ts` |
| Guía paso a paso + modo "más sencillo" | Funciona | prueba 4 |
| Entrada de voz (STT nativo) | Implementado, sin probar en teléfono | `VozGuiaSpeechModule.java` |
| Gemini con fallback offline | Funciona | `src/services/geminiService.ts` |
| Descubrimiento BLE | Implementado, sin probar con 2 teléfonos | `VozGuiaMeshModule.java` |
| Transporte de paquetes por BLE | **Simulado en JS** | ver §5 |
| Router flooding (TTL + deduplicación) | Funciona | prueba 3 |
| APK | **No generado** | ver §6 |
| UI según plantillas de Stitch | **Parcial** | ver §7 |

## 3. Arranque

```bash
npm install
npx expo start            # desarrollo (Expo Go no sirve: hay módulos nativos)
npx expo run:android      # build + instalar en teléfono por USB
npx tsc --noEmit          # verificación de tipos
npm test                  # 4 pruebas de lógica
```

Requiere Node 20+, JDK 17, Android SDK (platform 36, build-tools 36.0.0),
NDK 27.1.12297006 y CMake 3.22.1.

## 4. Mapa del repositorio

| Ruta | Propósito |
|---|---|
| `src/app/_layout.tsx` | Layout raíz de Expo Router |
| `src/app/(tabs)/_layout.tsx` | Barra de pestañas: Inicio · Trámites · Mesh |
| `src/app/(tabs)/index.tsx` | Pantalla principal: micrófono, texto, ejemplos |
| `src/app/(tabs)/tramites.tsx` | Catálogo con buscador y filtros |
| `src/app/(tabs)/mesh.tsx` | Estado de red, nodos y ajustes |
| `src/components/AccessibleButton.tsx` | Botón con área táctil grande y etiqueta ARIA |
| `src/components/StepGuideCard.tsx` | Tarjeta de pasos con botones de voz |
| `src/components/MeshStatusBanner.tsx` | Píldora de estado de la red |
| `src/services/database.ts` | SQLite: siembra del catálogo y consultas |
| `src/services/vectorSearch.ts` | Vector de términos + similitud coseno |
| `src/services/geminiService.ts` | Llamada a Gemini + guion offline |
| `src/services/voiceService.ts` | Guion hablado y TTS |
| `src/services/meshService.ts` | Descubrimiento BLE y (simulación de) relay |
| `src/services/meshRouter.ts` | Flooding controlado: TTL y deduplicación |
| `src/services/kvStore.ts` | Ajustes y consultas recientes |
| `src/native/androidBridge.ts` | Puente JS ↔ módulos Java + permisos |
| `native/android/` | **Copia versionada** de los módulos Java/Kotlin (§6) |
| `scripts/restore-native.ps1` | Reinstala `native/android/` dentro de `android/` |
| `docs/stitch/` | 4 plantillas HTML originales de Google Stitch |
| `docs/auditoria/` | Prompt de auditoría, proceso y mapa de diseño |
| `docs/traspaso/` | Este documento, la transcripción y la sesión cruda |
| `tests/vozGuia.test.ts` | 4 pruebas: búsqueda, categoría, router, modo simple |

## 5. Qué es real y qué está simulado

Esto es lo más importante para una demo o una evaluación. **No afirmar lo
contrario.**

| Función | Realidad |
|---|---|
| Anuncio BLE del nodo (`BluetoothLeAdvertiser`) | **Real** |
| Escaneo BLE por UUID `FEAA` (`BluetoothLeScanner`) | **Real** |
| Lista de vecinos con RSSI | **Real** |
| `broadcastPacket()` | **No transmite.** Valida TTL, deduplica y devuelve estado |
| Salto de 2 nodos que muestra la app | **Simulado** en `meshService.ts` |
| Catálogo, búsqueda, TTS, guía paso a paso | **Reales** |
| STT (`SpeechRecognizer`) | **Real**, pero nunca probado en un teléfono |
| Gemini | **Real**, opcional, con timeout de 12 s y fallback local |

Por qué: BLE advertising tiene un límite de ~27 bytes y no hay servidor GATT
implementado. Para cerrarlo hace falta framing de paquetes + GATT (o Nearby
Connections) + prueba con dos teléfonos.

## 6. Trampas del entorno (importante)

1. **`dl.google.com` está bloqueado en la red original** (TCP conecta, HTTPS
   muere por timeout). `dl-ssl.google.com` sí responde.
   - SDK: usar `$env:SDK_TEST_BASE_URL = "https://dl-ssl.google.com/android/repository/"`.
   - Gradle: Google Maven vive en ese host. Crear
     `%USERPROFILE%\.gradle\init.gradle` con el espejo
     `https://maven.aliyun.com/repository/google` (ejemplo completo en
     `docs/auditoria/PROCESO.md` y en `03_Instalacion` de la documentación).
2. **`android/` está en `.gitignore`** y lo regenera `expo prebuild --clean`.
   Los módulos nativos se perderían. Por eso hay una copia canónica en
   `native/android/`. Después de cualquier `prebuild`:

   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts/restore-native.ps1
   ```

3. **No hay emulador ni imagen de sistema** en la máquina original. Hace falta
   teléfono físico o instalar `emulator` + `system-images;android-36;google_apis;x86_64`.
4. **No había Git instalado.** El proyecto no tiene historial de versiones.
   Primer paso recomendado: `git init` y un commit propio.
5. **La llave de Gemini se guarda en el dispositivo** (se captura en Ajustes).
   Un APK es inspeccionable: para producción hay que moverla a un proxy
   (FastAPI o Cloud Run) y rotarla.

## 7. Diseño: plantillas de Stitch vs código

El equipo describió el proyecto a **Google Stitch**, generó 4 pantallas y las
exportó como HTML/Tailwind. Están en `docs/stitch/`. **No se aplicaron al
código.**

| Plantilla | Archivo | Estado en la app |
|---|---|---|
| Inicio | `01_inicio.html` | Parcial (`src/app/(tabs)/index.tsx`), otra paleta |
| Tablón de Avisos | `02_tablon-avisos.html` | **Ausente** |
| Conversación | `03_conversacion.html` | **Ausente** |
| Historial | `04_historial.html` | Parcial (`tramites.tsx`), sin estados ni modal |

Tokens a aplicar (detalle en `docs/auditoria/PLANTILLAS_STITCH.md`):

- Primario `#002E39`, secundario `#006A60`, fondo `#FAF9F6`,
  texto `#1A1C1A`, borde `#C0C8CB`, error `#BA1A1A`.
- Tipografía **Atkinson Hyperlegible Next**; `headline-lg-mobile` 28/36,
  `body-md` 16/24.
- Mínimo táctil 56 px, margen lateral 20 px, micrófono 144 px.
- Pestañas objetivo: **Inicio · Conversación · Historial** (hoy: Inicio ·
  Trámites · Mesh).

## 8. Pendientes priorizados

| P | Tarea | Criterio de hecho |
|---|---|---|
| P0 | Generar APK (`gradlew assembleDebug`) | Existe `app-debug.apk` e instala en un teléfono |
| P0 | Probar STT/TTS/permisos en teléfono real | Dictado produce búsqueda correcta |
| P1 | Que el agente tome la iniciativa al abrir | Al abrir, la app habla y ofrece trámites sin que el usuario pregunte |
| P1 | Aplicar las 4 pantallas de Stitch | Navegación Inicio/Conversación/Historial + drawer de Avisos, con tokens |
| P1 | Mover la llave de Gemini a un proxy | El APK no contiene ninguna llave |
| P2 | Transporte BLE real (GATT o Nearby Connections) | Dos teléfonos intercambian un trámite en modo avión |
| P2 | Migrar módulos Java a un módulo local de Expo / config plugin | `prebuild --clean` ya no los borra |
| P3 | Embeddings reales y catálogo ampliado | Búsqueda entiende sinónimos fuera del vocabulario actual |

## 9. Decisión de stack abierta

El proyecto está en **Expo + TypeScript** porque el prompt original lo pedía así
("ayúdame a hacer la siguiente aplicación pero con TypeScript"). Después surgió
la duda de si el reglamento del hackathon exige **solo Python**. Eso **no está
confirmado**. Antes de reescribir nada hay que responder:

- ¿El reglamento prohíbe lenguajes compilados o solo frameworks concretos?
- ¿"Sin Java" aplica al código de la app o también a los módulos nativos?
- ¿La entrega exige código fuente o basta el APK?

Reescribir en Kivy/Buildozer cuesta días y pierde BLE estable, accesibilidad y
las plantillas. **No reescribir hasta tener la regla por escrito.**

## 10. Reglas para quien continúe

1. No afirmar que el mesh transporta paquetes. Decir: *descubrimiento real,
   transporte en prototipo*.
2. No meter llaves en el APK ni en el repositorio.
3. No ejecutar `expo prebuild --clean` sin correr `scripts/restore-native.ps1`
   después.
4. No inventar pruebas ni versiones. Si no se ejecutó, se escribe "no ejecutado".
5. Mantener el español en la UI y en los textos para el usuario.
6. Antes de declarar terminado: `npx tsc --noEmit` y `npm test` en verde.

## 11. Documentos relacionados

- `docs/traspaso/SESION_TRANSCRIPCION.md` — cómo se construyó, turno por turno.
- `docs/auditoria/PROCESO.md` — cronología con horas y evidencia.
- `docs/auditoria/PLANTILLAS_STITCH.md` — tokens, medidas y mapa de brechas.
- `docs/stitch/README.md` — las 4 plantillas y cómo abrirlas.
- `Documents\VozGuia-Entrega\` (fuera del repo) — documentación de entrega en
  `.docx`, `.pdf` y `.md`.
