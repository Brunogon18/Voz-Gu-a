# Restaura los módulos nativos dentro de android/ tras un prebuild.
# Uso: powershell -ExecutionPolicy Bypass -File scripts/restore-native.ps1

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root "native\android"
$dst = Join-Path $root "android\app\src\main\java\com\deepcode\vozguia"

if (-not (Test-Path $src)) {
    throw "No existe la copia canónica: $src"
}

if (-not (Test-Path (Join-Path $root "android"))) {
    throw "No existe android/. Ejecuta primero: npx expo prebuild --platform android"
}

New-Item -ItemType Directory -Force -Path $dst | Out-Null
Copy-Item -Path (Join-Path $src "*") -Destination $dst -Recurse -Force

Write-Host "Modulos restaurados en:" $dst
Get-ChildItem $dst -Recurse -File |
    ForEach-Object { "  " + $_.FullName.Replace($dst + "\", "") }

Write-Host ""
Write-Host "Verifica que MainApplication.kt siga registrando VozGuiaPackage():"
Select-String -Path (Join-Path $dst "MainApplication.kt") -Pattern "add\(VozGuiaPackage" |
    ForEach-Object { "  linea " + $_.LineNumber + ": " + $_.Line.Trim() }
