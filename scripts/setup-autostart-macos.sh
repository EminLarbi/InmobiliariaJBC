#!/usr/bin/env bash
set -euo pipefail

PORT="8080"
USE_DOCKER=1
LABEL="com.inmobiliaria.jbc"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --port) shift; PORT="${1:-8080}"; shift || true ;;
    --no-docker) USE_DOCKER=0; shift ;;
    *) echo "Uso: setup-autostart-macos.sh [--port 8080] [--no-docker]"; exit 1 ;;
  esac
done

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
DEPLOY_SH="${ROOT_DIR}/scripts/deploy.sh"
PLIST_PATH="${HOME}/Library/LaunchAgents/${LABEL}.plist"
LOG_DIR="${HOME}/Library/Logs/${LABEL}"
mkdir -p "$LOG_DIR"

if [[ ! -x "$DEPLOY_SH" ]]; then chmod +x "$DEPLOY_SH"; fi

if [[ "$USE_DOCKER" -eq 1 ]] && command -v docker >/dev/null 2>&1; then
  PROGRAM_ARGS=("$DEPLOY_SH" "up" "--port" "$PORT")
else
  PROGRAM_ARGS=("$DEPLOY_SH" "up" "--port" "$PORT" "--detach")
fi

cat >"$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    $(for a in "${PROGRAM_ARGS[@]}"; do echo "    <string>${a//&/&amp;}</string>"; done)
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><false/>
  <key>StandardOutPath</key><string>${LOG_DIR}/stdout.log</string>
  <key>StandardErrorPath</key><string>${LOG_DIR}/stderr.log</string>
</dict>
</plist>
EOF

launchctl unload "$PLIST_PATH" >/dev/null 2>&1 || true
launchctl load "$PLIST_PATH"
echo "Auto-arranque configurado. Etiqueta: $LABEL. Puerto: $PORT"
echo "Ver logs en: $LOG_DIR"

