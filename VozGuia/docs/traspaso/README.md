# Traspaso de Voz Guía — lee esto primero

Este paquete existe para que **otra persona (o su agente) pueda continuar el
proyecto sin acceso a la máquina original ni a la conversación original**.

## Si eres un agente de IA

1. Lee **`HANDOFF.md`** completo antes de tocar nada.
2. Ejecuta `npx tsc --noEmit` y `npm test` para confirmar el punto de partida.
3. No modifiques archivos hasta haber leído las secciones *Qué es real y qué
   está simulado* y *Trampas del entorno* de `HANDOFF.md`.
4. Si algo del código contradice este documento, **gana el código**; reporta la
   discrepancia en lugar de asumir.

## Si eres una persona

- `HANDOFF.md` — estado, pendientes, trampas y cómo arrancar. Empieza aquí.
- `SESION_TRANSCRIPCION.md` — la conversación completa y legible con el agente
  que construyó el proyecto, en 5 turnos.
- `sesion_cruda/` — los artefactos originales de la sesión (base de datos,
  transcripción en JSONL, historial de prompts, manifiesto con hashes).
- `../stitch/` — las 4 plantillas HTML originales de Google Stitch.
- `../auditoria/` — prompt de auditoría, proceso reconstruido y mapa de diseño.

## Cómo continuar la conversación con agy

**Opción A (recomendada, siempre funciona).** Abre el proyecto y entrega el
traspaso como primer mensaje:

```powershell
cd "C:\ruta\a\Voz Guia"
agy
```

y pega:

```
Lee docs/traspaso/HANDOFF.md y docs/traspaso/SESION_TRANSCRIPCION.md.
Después ejecuta npx tsc --noEmit y npm test, y dime en qué estado real está
el proyecto antes de proponer el siguiente paso. No escribas código todavía.
```

**Opción B (experimental, misma máquina o mismo usuario de Windows).** agy
guarda las conversaciones en
`%USERPROFILE%\.gemini\antigravity-cli\conversations\<id>.db`. Copiar
`sesion_cruda/conversacion.db` a esa carpeta y lanzar
`agy --conversation 778aedbd-7883-4fff-adaa-e395656cb6e2` puede reabrir la
sesión, pero depende de la versión del cliente y de que el ID no exista ya.
Si falla, usa la Opción A: el traspaso está pensado para no necesitarla.

## Qué NO viaja en este paquete

- `node_modules/`, `dist-tests/`, `.expo/` y los binarios de `android/`.
- Llaves de API: no hay ninguna en el proyecto ni en la sesión (verificado).
  La app las captura en tiempo de ejecución y las guarda en el dispositivo.
- La cuota ni la cuenta de Antigravity del autor original.
