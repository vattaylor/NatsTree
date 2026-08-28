#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RELEASE="$ROOT/release"
UNPACKED="$RELEASE/win-unpacked"
TOOLS="$ROOT/.win-installer-tools"
VERSION="$(node -p "require('$ROOT/package.json').version")"
OUT="$RELEASE/NatsTree-${VERSION}-win-x64-setup.exe"

if [[ ! -f "$UNPACKED/NatsTree.exe" ]]; then
  echo "Missing $UNPACKED/NatsTree.exe — packaging Windows app first..."
  (
    cd "$ROOT"
    npx electron-builder --win zip
  )
fi

mkdir -p "$TOOLS"
if [[ ! -x "$TOOLS/7zz" ]]; then
  curl -fsSL "https://github.com/ip7z/7zip/releases/download/26.02/7z2602-linux-x64.tar.xz" | tar -xJ -C "$TOOLS" 7zz
  chmod +x "$TOOLS/7zz"
fi
if [[ ! -f "$TOOLS/7zSD.sfx" ]]; then
  curl -fsSL "https://github.com/ip7z/7zip/releases/download/26.02/lzma2602.7z" -o "$TOOLS/lzma.7z"
  "$TOOLS/7zz" e -y "-o$TOOLS" "$TOOLS/lzma.7z" "bin/7zSD.sfx"
fi

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
cp -a "$UNPACKED/." "$STAGE/"

cat > "$STAGE/install-shortcuts.cmd" <<'EOF'
@echo off
setlocal
set "DIR=%~dp0"
set "APP=%DIR%NatsTree.exe"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$dir = $env:DIR; $app = Join-Path $dir 'NatsTree.exe'; $ws = New-Object -ComObject WScript.Shell; $desk = [Environment]::GetFolderPath('Desktop'); $s = $ws.CreateShortcut((Join-Path $desk 'NatsTree.lnk')); $s.TargetPath = $app; $s.WorkingDirectory = $dir; $s.Save(); $sm = Join-Path ([Environment]::GetFolderPath('StartMenu')) 'Programs\NatsTree.lnk'; $s = $ws.CreateShortcut($sm); $s.TargetPath = $app; $s.WorkingDirectory = $dir; $s.Save();"
start "" "%APP%"
EOF

ARCHIVE="$STAGE/payload.7z"
rm -f "$ARCHIVE"
(
  cd "$STAGE"
  "$TOOLS/7zz" a -t7z -mx=9 -m0=lzma2 "$ARCHIVE" . "-x!payload.7z" >/dev/null
)

CONFIG="$STAGE/config.txt"
# 7-Zip SFX config must be UTF-8 without a BOM.
printf '%s\n' \
  ';!@Install@!UTF-8!' \
  'Title="NatsTree Setup"' \
  "BeginPrompt=\"Install NatsTree ${VERSION}?\"" \
  'CancelPrompt="Cancel NatsTree setup?"' \
  'ExtractTitle="Installing NatsTree"' \
  'ExtractDialogText="Copying files. This may take a moment."' \
  'InstallPath="%LOCALAPPDATA%\\Programs\\NatsTree"' \
  'GUIFlags="8+32+64"' \
  'Overwrite="2"' \
  'RunProgram="install-shortcuts.cmd"' \
  ';!@InstallEnd@!' > "$CONFIG"

cat "$TOOLS/7zSD.sfx" "$CONFIG" "$ARCHIVE" > "$OUT"
ls -lh "$OUT"
echo "Wrote $OUT"
