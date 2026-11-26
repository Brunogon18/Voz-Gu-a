# Módulos nativos (copia canónica)

`android/` está en `.gitignore` y `expo prebuild --clean` lo regenera, borrando
los módulos nativos escritos a mano. Esta carpeta conserva la copia que sí se
versiona.

| Archivo | Propósito |
|---|---|
| `MainActivity.kt` | Entrada de Android (generado por Expo) |
| `MainApplication.kt` | Registra `VozGuiaPackage` en la lista de paquetes |
| `VozGuiaPackage.java` | Agrupa los módulos nativos |
| `mesh/VozGuiaMeshModule.java` | BLE: anuncia el nodo y escanea vecinos |
| `speech/VozGuiaSpeechModule.java` | STT con `SpeechRecognizer` |

## Restaurar después de un prebuild

```powershell
npx expo prebuild --platform android
powershell -ExecutionPolicy Bypass -File scripts/restore-native.ps1
```

El script copia esta carpeta a
`android/app/src/main/java/com/deepcode/vozguia/` y lista lo restaurado.

## Deuda pendiente

La solución definitiva no es copiar a mano: es mover estos módulos a un
**módulo local de Expo** o a un **config plugin**, para que sobrevivan a
`prebuild` sin pasos manuales.
