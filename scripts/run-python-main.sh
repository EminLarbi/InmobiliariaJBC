#!/usr/bin/env bash
set -euo pipefail

# Ejecuta el main de Python del proyecto con reintentos automáticos.
# Detecta python3 en sistemas macOS/Linux, permite override con --python,
# o ejecución dentro de un entorno conda vía --conda-env.

# Ampliar PATH para brew en macOS (ARM/Intel) por si launchd no hereda PATH completo
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

PYTHON_BIN=""
CONDA_ENV=""
RETRIES=3
RETRY_DELAY=300 # segundos
while [[ $# -gt 0 ]]; do
  case "$1" in
    --python)
      shift; PYTHON_BIN="${1:-}"; shift || true ;;
    --conda-env)
      shift; CONDA_ENV="${1:-}"; shift || true ;;
    --retries)
      shift; RETRIES="${1:-3}"; shift || true ;;
    --retry-delay)
      shift; RETRY_DELAY="${1:-300}"; shift || true ;;
    *)
      echo "Uso: run-python-main.sh [--python /ruta/a/python] [--conda-env nombre] [--retries N] [--retry-delay SEG]" >&2
      exit 1
      ;;
  esac
done

PYTHON_CMD=()
if [[ -n "$CONDA_ENV" ]]; then
  # Intentar usar 'conda run' o 'micromamba run'. Si no están disponibles,
  # buscar directamente el binario python del entorno en rutas típicas
  # (incluyendo miniforge3/envs y variantes bajo ~/opt/...).
  ensure_conda() {
    if command -v conda >/dev/null 2>&1; then return 0; fi
    # Intentar auto-cargar conda.sh en ubicaciones típicas (Anaconda/Miniconda/Miniforge)
    # Incluye rutas de macOS/Linux y también rutas comunes en Windows (Git Bash)
    for d in \
      "$HOME/miniconda3" \
      "$HOME/anaconda3" \
      "$HOME/miniforge3" \
      "$HOME/mambaforge" \
      "$HOME/opt/miniconda3" \
      "$HOME/opt/anaconda3" \
      "$HOME/opt/miniforge3" \
      "/opt/homebrew/Caskroom/miniconda/base" \
      "/opt/homebrew/Caskroom/miniforge/base" \
      "/c/ProgramData/miniconda3" \
      "/c/ProgramData/Anaconda3" \
      "/c/ProgramData/mambaforge" \
      "/c/mambaforge"; do
      if [[ -f "$d/etc/profile.d/conda.sh" ]]; then
        # shellcheck disable=SC1090
        source "$d/etc/profile.d/conda.sh" || true
        break
      fi
    done
  }

  find_env_python() {
    local env_name="$1"
    local cand
    for cand in \
      "$HOME/miniconda3/envs/$env_name/bin/python" \
      "$HOME/anaconda3/envs/$env_name/bin/python" \
      "$HOME/miniforge3/envs/$env_name/bin/python" \
      "$HOME/mambaforge/envs/$env_name/bin/python" \
      "$HOME/opt/miniconda3/envs/$env_name/bin/python" \
      "$HOME/opt/anaconda3/envs/$env_name/bin/python" \
      "$HOME/opt/miniforge3/envs/$env_name/bin/python" \
      "/c/ProgramData/miniconda3/envs/$env_name/python.exe" \
      "/c/ProgramData/Anaconda3/envs/$env_name/python.exe" \
      "/c/ProgramData/mambaforge/envs/$env_name/python.exe"; do
      if [[ -x "$cand" ]]; then
        echo "$cand"
        return 0
      fi
    done
    return 1
  }

  ensure_conda || true
  if command -v conda >/dev/null 2>&1; then
    PYTHON_CMD=(conda run -n "$CONDA_ENV" python)
  elif command -v micromamba >/dev/null 2>&1; then
    PYTHON_CMD=(micromamba run -n "$CONDA_ENV" python)
  else
    # Fallback: usar directamente el binario del entorno si existe
    if env_py=$(find_env_python "$CONDA_ENV"); then
      PYTHON_CMD=("$env_py")
    else
      echo "No se encontró 'conda' ni 'micromamba', y no existe un python para el entorno '$CONDA_ENV' en rutas típicas (incluyendo miniforge3/envs)." >&2
      exit 1
    fi
  fi
else
  if [[ -z "${PYTHON_BIN}" ]]; then
    if command -v python3 >/dev/null 2>&1; then
      PYTHON_BIN="python3"
    elif command -v python >/dev/null 2>&1; then
      PYTHON_BIN="python"
    else
      echo "No se encontró 'python3' ni 'python' en PATH." >&2
      exit 1
    fi
  fi
  PYTHON_CMD=("$PYTHON_BIN")
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
PY_DIR="${ROOT_DIR}/InmobiliariaJBCPython"

cd "$PY_DIR"
echo "[python-daily] $(date +'%Y-%m-%d %H:%M:%S') Ejecutando main.py con '${PYTHON_CMD[*]}' en ${PY_DIR} (retries=${RETRIES}, delay=${RETRY_DELAY}s)" >&2

attempt=1
exit_code=0
while :; do
  set +e
  "${PYTHON_CMD[@]}" main.py
  exit_code=$?
  set -e
  if [[ $exit_code -eq 0 ]]; then
    echo "[python-daily] Ejecución exitosa en el intento ${attempt}" >&2
    break
  fi
  if [[ $attempt -ge $RETRIES ]]; then
    echo "[python-daily] Falló tras ${attempt} intentos. Último código: ${exit_code}" >&2
    break
  fi
  echo "[python-daily] Intento ${attempt} falló (code=${exit_code}). Reintentando en ${RETRY_DELAY}s..." >&2
  sleep "$RETRY_DELAY"
  attempt=$((attempt+1))
done

exit "$exit_code"
