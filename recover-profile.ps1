# Restores a damaged DSH profile after a crash-loop, without needing DSH to start.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File recover-profile.ps1 [-ProfileDir <dir>] [-Plugin <name>]
#
# What it does (and nothing else):
#   1. backs up the current cordis.patch.yml as cordis.patch.yml.bak-before-recover-<epoch>,
#   2. restores the newest cordis.patch.yml backup larger than 1000 bytes
#      (the crash dialog writes a ~700 byte truncated copy),
#   3. removes the plugin from dsh.profile.bundles in package.json so the app boots,
#      keeping its dependency entry so a later reinstall can link it again.

param(
  [string]$ProfileDir = (Join-Path $env:USERPROFILE '.dsh\profiles\desktop'),
  [string]$Plugin = '@local/dsh-doc-pane'
)

$ErrorActionPreference = 'Stop'
$stamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

if (-not (Test-Path -LiteralPath $ProfileDir)) {
  Write-Host "profile not found: $ProfileDir" -ForegroundColor Red
  exit 1
}

$patch = Join-Path $ProfileDir 'cordis.patch.yml'
$candidates = @(Get-ChildItem -LiteralPath $ProfileDir -Filter 'cordis.patch.yml.bak-*' -File -ErrorAction SilentlyContinue |
  Where-Object { $_.Length -gt 1000 } |
  Sort-Object LastWriteTime -Descending)

if ($candidates.Count -gt 0) {
  $best = $candidates[0]
  if (Test-Path -LiteralPath $patch) {
    Copy-Item -LiteralPath $patch -Destination "$patch.bak-before-recover-$stamp" -Force
    Write-Host ("current cordis.patch.yml backed up as cordis.patch.yml.bak-before-recover-{0}" -f $stamp)
  }
  Copy-Item -LiteralPath $best.FullName -Destination $patch -Force
  Write-Host ("restored cordis.patch.yml from {0} ({1} bytes)" -f $best.Name, $best.Length) -ForegroundColor Green
} else {
  Write-Host 'no cordis.patch.yml backup larger than 1000 bytes found; patch left as is' -ForegroundColor Yellow
}

$pkgPath = Join-Path $ProfileDir 'package.json'
if (Test-Path -LiteralPath $pkgPath) {
  Copy-Item -LiteralPath $pkgPath -Destination "$pkgPath.bak-before-recover-$stamp" -Force
  $raw = Get-Content -LiteralPath $pkgPath -Raw
  $pkg = $raw | ConvertFrom-Json
  $bundles = @($pkg.dsh.profile.bundles)
  $kept = @($bundles | Where-Object { $_ -ne $Plugin })
  if ($kept.Count -ne $bundles.Count) {
    $pkg.dsh.profile.bundles = $kept
    # UTF8 without BOM: Set-Content -Encoding UTF8 on Windows PowerShell 5.1
    # prepends a BOM, and a BOM-prefixed package.json is invalid JSON for DSH.
    $json = $pkg | ConvertTo-Json -Depth 20
    [IO.File]::WriteAllText($pkgPath, $json, (New-Object System.Text.UTF8Encoding($false)))
    Write-Host ("removed {0} from dsh.profile.bundles ({1} -> {2} bundles)" -f $Plugin, $bundles.Count, $kept.Count) -ForegroundColor Green
  } else {
    Write-Host ("{0} was not in dsh.profile.bundles; package.json unchanged" -f $Plugin)
  }
} else {
  Write-Host "package.json not found: $pkgPath" -ForegroundColor Yellow
}

Write-Host 'done. Start DSH again; the plugin can be reinstalled later.'
