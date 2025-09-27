#!/usr/bin/env bash
set -euo pipefail

# Crea un LaunchAgent que ejecuta el main de Python cada día a una hora dada (por defecto 00:00).

LABEL="com.inmobiliaria.jbc.python-daily"
TIME="00:00"   # HH:MM
PYTHON_BIN=""  # opcional: ruta a python
RETRIES=3
RETRY_DELAY=300
CONDA_ENV=""
RUN_AT_LOAD=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --time)
      shift; TIME="${1:-00:00}"; shift || true ;;
    --python)
      shift; PYTHON_BIN="${1:-}"; shift || true ;;
    --retries)
      shift; RETRIES="${1:-3}"; shift || true ;;
    --retry-delay)
      shift; RETRY_DELAY="${1:-300}"; shift || true ;;
    --conda-env)
      shift; CONDA_ENV="${1:-}"; shift || true ;;
    --label)
      shift; LABEL="${1:-$LABEL}"; shift || true ;;
    --no-run-at-load)
      RUN_AT_LOAD=0; shift || true ;;
    *)
      echo "Uso: setup-daily-python-macos.sh [--time HH:MM] [--python /ruta/a/python] [--conda-env nombre] [--retries N] [--retry-delay SEG] [--label com.id] [--no-run-at-load]" >&2
      exit 1
      ;;
  esac
done

if [[ ! "$TIME" =~ ^([0-1][0-9]|2[0-3]):([0-5][0-9])$ ]]; then
  echo "Hora inválida: $TIME (uso HH:MM 24h)" >&2
  exit 1
fi
HOUR="${TIME%%:*}"
MIN="${TIME##*:}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
RUNNER="${ROOT_DIR}/scripts/run-python-main.sh"
PLIST_PATH="${HOME}/Library/LaunchAgents/${LABEL}.plist"
LOG_DIR="${HOME}/Library/Logs/${LABEL}"
mkdir -p "$LOG_DIR"

PROGRAM_ARGS=("/bin/bash" "$RUNNER")
if [[ -n "$PYTHON_BIN" ]]; then
  PROGRAM_ARGS+=("--python" "$PYTHON_BIN")
fi
if [[ -n "$CONDA_ENV" ]]; then
  PROGRAM_ARGS+=("--conda-env" "$CONDA_ENV")
fi
PROGRAM_ARGS+=("--retries" "$RETRIES" "--retry-delay" "$RETRY_DELAY")

{
  cat <<PLIST_HEADER
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
PLIST_HEADER
  for a in "${PROGRAM_ARGS[@]}"; do
    printf "    <string>%s</string>\n" "${a//&/&amp;}"
  done
  cat <<PLIST_FOOTER
  </array>
  <key>WorkingDirectory</key><string>${ROOT_DIR}/InmobiliariaJBCPython</string>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key><integer>${HOUR}</integer>
    <key>Minute</key><integer>${MIN}</integer>
  </dict>
  <key>RunAtLoad</key><$([[ "$RUN_AT_LOAD" == "1" ]] && echo true || echo false)/>
  <key>KeepAlive</key><false/>
  <key>StandardOutPath</key><string>${LOG_DIR}/stdout.log</string>
  <key>StandardErrorPath</key><string>${LOG_DIR}/stderr.log</string>
</dict>
</plist>
PLIST_FOOTER
} >"$PLIST_PATH"

launchctl unload "$PLIST_PATH" >/dev/null 2>&1 || true
launchctl load "$PLIST_PATH"

# Aviso de rutas protegidas por macOS (TCC) que pueden bloquear el acceso desde launchd
case "$ROOT_DIR" in
  "$HOME/Downloads"*|"$HOME/Desktop"*|"$HOME/Documents"*|"$HOME/Library/Mobile Documents"*)
    echo "ADVERTENCIA: El proyecto está bajo una carpeta protegida por macOS (Desktop/Documents/Downloads/iCloud)." >&2
    echo "El LaunchAgent puede fallar con 'Operation not permitted'." >&2
    echo "Sugerencia: mueve el proyecto a una ruta como ~/Projects o concede Acceso Total al Disco a /bin/bash y al binario de Python." >&2
    ;;
esac

echo "Tarea diaria configurada: $LABEL"
echo "Hora: $TIME"
echo "Logs: $LOG_DIR"
