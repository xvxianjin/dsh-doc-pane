@echo off
rem Emergency recovery for a DSH desktop that will not start because of a
rem third-party plugin. The "disable third-party plugins, back up the profile
rem patch and restart" button in the crash dialog truncates cordis.patch.yml, so
rem this script puts the profile back in order without touching anything else:
rem   1. restores the newest trustable cordis.patch.yml backup (the truncated ones
rem      are ~700 bytes, the real one is ~1400),
rem   2. removes this plugin from dsh.profile.bundles so the next launch boots.
rem Close DSH first, then double-click this file.
setlocal
set "PS=powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0recover-profile.ps1""
%PS%
echo.
pause
