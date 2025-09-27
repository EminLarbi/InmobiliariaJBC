#!/usr/bin/env bash

set -euo pipefail

APP_NAME="inmobiliaria-jbc"
IMAGE_NAME="${APP_NAME}:prod"
CONTAINER_NAME="${APP_NAME}"
HOST_PORT="8080"
PREVIEW_PORT="8080"

# Flags para tareas Python diarias
SETUP_PY_DAILY=0
PY_TIME="00:00"
PY_BIN=""
PY_RETRIES=3
PY_RETRY_DELAY=300
RUN_PY_NOW=1
CONDA_ENV=""

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
BUILD_DIR="${ROOT_DIR}/build"
FORCE_BUILD=0
FORCE_IMAGE_BUILD=0

log() { echo -e "[deploy] $*"; }
err() { echo -e "[deploy][error] $*" >&2; }

has_cmd() { command -v "$1" >/dev/null 2>&1; }

# Calcula un fingerprint de las fuentes relevantes para decidir si la
# imagen Docker necesita reconstruirse.
src_fingerprint() {
  local -a files=()
  local p
  for p in \
    "docker/Dockerfile" \
    "docker/nginx.conf" \
    "package.json" \
    "package-lock.json" \
    "vite.config.ts" \
    "index.html" \
    "src" \
    "public"; do
    if [[ -e "${ROOT_DIR}/${p}" ]]; then
      if [[ -d "${ROOT_DIR}/${p}" ]]; then
        while IFS= read -r -d '' f; do files+=("$f"); done < <(find "${ROOT_DIR}/${p}" -type f -print0)
      else
        files+=("${ROOT_DIR}/${p}")
      fi
    fi
  done
  if [[ ${#files[@]} -eq 0 ]]; then echo ""; return 0; fi
  printf '%s\0' "${files[@]}" | sort -z | xargs -0 sha256sum | sha256sum | awk '{print $1}'
}

check_node() {
  if ! has_cmd node || ! has_cmd npm; then
    err "Node.js y npm son requeridos. Instala Node 18+ desde https://nodejs.org/"
    exit 1;
  fi
  local major
  major=$(node -p "process.versions.node.split('.') [0]")
  if [[ "$major" -lt 18 ]]; then
    err "Se requiere Node.js >= 18. Versión actual: $(node -v)"
    exit 1
  fi
}

build_app() {
  check_node
  # Si ya existe build y no se fuerza, omitir recompilar
  if [[ "${FORCE_BUILD}" != "1" && -d "${BUILD_DIR}" && -n "$(ls -A "${BUILD_DIR}" 2>/dev/null)" ]]; then
    log "Build existente encontrado en '${BUILD_DIR}'. Omitiendo 'npm run build' (usa --force-build para forzar)."
    return
  fi
  log "Instalando dependencias (esto puede tardar)..."
  if [[ -f "${ROOT_DIR}/package-lock.json" ]]; then
    npm ci --prefix "${ROOT_DIR}"
  else
    npm install --prefix "${ROOT_DIR}"
  fi
  log "Construyendo aplicación (salida en '${BUILD_DIR}')..."
  npm run build --prefix "${ROOT_DIR}"
}

docker_up() {
  if ! has_cmd docker; then
    err "Docker no está disponible. Usa 'preview' o instala Docker Desktop."
    exit 1
  fi

  build_app

  local fp
  fp=$(src_fingerprint)
  local skip=0
  if [[ "${FORCE_IMAGE_BUILD}" != "1" ]] && docker image inspect "${IMAGE_NAME}" >/dev/null 2>&1; then
    # shellcheck disable=SC2016
    local current
    current=$(docker image inspect --format '{{ index .Config.Labels "jbc.build.fingerprint" }}' "${IMAGE_NAME}" 2>/dev/null || true)
    if [[ -n "${current}" && "${current}" == "${fp}" ]]; then
      skip=1
    fi
  fi

  if [[ "${skip}" != "1" ]]; then
    log "Construyendo imagen Docker '${IMAGE_NAME}'..."
    docker build --label "jbc.build.fingerprint=${fp}" -t "${IMAGE_NAME}" -f "${ROOT_DIR}/docker/Dockerfile" "${ROOT_DIR}"
  else
    log "Imagen '${IMAGE_NAME}' ya actual (fingerprint=${fp}). Omitiendo 'docker build'."
  fi

  if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    log "Eliminando contenedor existente '${CONTAINER_NAME}'..."
    docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
  fi

  log "Levantando contenedor '${CONTAINER_NAME}' en http://localhost:${HOST_PORT} ..."
  docker run -d --restart unless-stopped --name "${CONTAINER_NAME}" -p "${HOST_PORT}:80" "${IMAGE_NAME}"
  log "Listo. Accede en http://localhost:${HOST_PORT}"
}

docker_down() {
  if ! has_cmd docker; then
    err "Docker no está disponible."
    exit 1
  fi
  if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    log "Parando y eliminando contenedor '${CONTAINER_NAME}'..."
    docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
    log "Contenedor eliminado."
  else
    log "No hay contenedor '${CONTAINER_NAME}'."
  fi
}

preview_up() {
  check_node
  build_app

  log "Sirviendo build con 'vite preview' en http://localhost:${PREVIEW_PORT} ..."
  # Ejecuta en foreground salvo que se use --detach
  if [[ "${DETACH:-0}" == "1" ]]; then
    nohup npx --yes vite preview --host 0.0.0.0 --strictPort --port "${PREVIEW_PORT}" --outDir "${BUILD_DIR}" > "${ROOT_DIR}/preview.log" 2>&1 &
    echo $! > "${ROOT_DIR}/preview.pid"
    log "Preview en background (PID $(cat "${ROOT_DIR}/preview.pid")). Logs: ${ROOT_DIR}/preview.log"
  else
    npx --yes vite preview --host 0.0.0.0 --strictPort --port "${PREVIEW_PORT}" --outDir "${BUILD_DIR}"
  fi
}

preview_down() {
  if [[ -f "${ROOT_DIR}/preview.pid" ]]; then
    local pid
    pid=$(cat "${ROOT_DIR}/preview.pid")
    if ps -p "$pid" >/dev/null 2>&1; then
      log "Parando preview (PID $pid)..."
      kill "$pid" || true
      rm -f "${ROOT_DIR}/preview.pid"
      log "Preview detenido."
    else
      rm -f "${ROOT_DIR}/preview.pid"
      log "No había proceso preview activo."
    fi
  else
    log "No hay preview en background."
  fi
}

status() {
  if has_cmd docker; then
    if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
      log "Estado Docker: ejecutándose (${CONTAINER_NAME}) en puerto ${HOST_PORT}"
    else
      log "Estado Docker: no ejecutándose"
    fi
  fi
  if [[ -f "${ROOT_DIR}/preview.pid" ]]; then
    local pid
    pid=$(cat "${ROOT_DIR}/preview.pid")
    if ps -p "$pid" >/dev/null 2>&1; then
      log "Estado preview: ejecutándose (PID $pid) en puerto ${PREVIEW_PORT}"
      return
    fi
  fi
}

logs() {
  if has_cmd docker && docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    docker logs -f "${CONTAINER_NAME}"
  elif [[ -f "${ROOT_DIR}/preview.log" ]]; then
    tail -n 200 -f "${ROOT_DIR}/preview.log"
  else
    log "No hay logs disponibles."
  fi
}

usage() {
  cat <<EOF
Uso: scripts/deploy.sh <comando> [opciones]

Comandos:
  build            Construye la app de producción
  up               Despliega (prefiere Docker si está disponible)
  down             Para el despliegue activo (Docker o preview)
  status           Muestra estado de despliegue
  logs             Muestra logs (Docker o preview)

Opciones:
  --port <puerto>  Puerto host (Docker o preview) [por defecto: 8080]
  --detach         Ejecuta 'preview' en background
  --setup-python-daily       Configura tarea diaria de Python (00:00 por defecto)
  --python-time HH:MM        Hora diaria para Python (por defecto 00:00)
  --python-bin <ruta>        Ruta a Python específico
  --conda-env <nombre>       Ejecuta usando 'conda run -n <nombre> python'
  --python-retries <n>       Reintentos del job Python (por defecto 3)
  --python-retry-delay <s>   Segundos entre reintentos (por defecto 300)
  --skip-python-now          No ejecutar el job Python inmediatamente en 'up'
  --force-build              Fuerza reconstruir aunque exista build previo
  --force-image-build        Fuerza crear la imagen aunque ya exista

Ejemplos:
  scripts/deploy.sh up --port 8080
  scripts/deploy.sh up --detach             # usa preview en background si no hay Docker
  scripts/deploy.sh up --setup-python-daily --python-time 00:00
  scripts/deploy.sh down
  scripts/deploy.sh logs
EOF
}

main() {
  if [[ $# -lt 1 ]]; then usage; exit 1; fi
  local cmd="$1"; shift || true
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --port)
        shift; [[ $# -gt 0 ]] || { err "--port requiere un valor"; exit 1; }
        HOST_PORT="$1"; PREVIEW_PORT="$1"; shift;
        ;;
      --detach)
        DETACH=1; shift;
        ;;
      --setup-python-daily)
        SETUP_PY_DAILY=1; shift;
        ;;
      --python-time)
        shift; [[ $# -gt 0 ]] || { err "--python-time requiere HH:MM"; exit 1; }
        PY_TIME="$1"; shift;
        ;;
      --python-bin)
        shift; [[ $# -gt 0 ]] || { err "--python-bin requiere ruta"; exit 1; }
        PY_BIN="$1"; shift;
        ;;
      --python-retries)
        shift; [[ $# -gt 0 ]] || { err "--python-retries requiere número"; exit 1; }
        PY_RETRIES="$1"; shift;
        ;;
      --python-retry-delay)
        shift; [[ $# -gt 0 ]] || { err "--python-retry-delay requiere segundos"; exit 1; }
        PY_RETRY_DELAY="$1"; shift;
        ;;
      --conda-env)
        shift; [[ $# -gt 0 ]] || { err "--conda-env requiere nombre"; exit 1; }
        CONDA_ENV="$1"; shift;
        ;;
      --skip-python-now)
        RUN_PY_NOW=0; shift;
        ;;
      --force-build)
        FORCE_BUILD=1; shift;
        ;;
      --force-image-build)
        FORCE_IMAGE_BUILD=1; shift;
        ;;
      *)
        break;
        ;;
    esac
  done

  case "$cmd" in
    build) build_app ;;
    up)
      if has_cmd docker; then
        docker_up
      else
        preview_up
      fi
      if [[ "$SETUP_PY_DAILY" == "1" ]]; then
        case "$(uname -s)" in
          Darwin)
            log "Configurando tarea diaria de Python a las ${PY_TIME} (retries=${PY_RETRIES}, delay=${PY_RETRY_DELAY}s)..."
            args=("${ROOT_DIR}/scripts/setup-daily-python-macos.sh" "--time" "$PY_TIME" "--retries" "$PY_RETRIES" "--retry-delay" "$PY_RETRY_DELAY")
            if [[ "$RUN_PY_NOW" == "0" ]]; then args+=("--no-run-at-load"); fi
            if [[ -n "$PY_BIN" ]]; then args+=("--python" "$PY_BIN"); fi
            if [[ -n "$CONDA_ENV" ]]; then args+=("--conda-env" "$CONDA_ENV"); fi
            bash "${args[@]}"
            ;;
          Linux)
            err "Configuración diaria de Python no implementada en Linux en este script. Usa cron manualmente."
            ;;
          *)
            err "Auto-configuración diaria soportada desde aquí sólo en macOS. En Windows usa scripts/deploy.ps1 -SetupPythonDaily."
            ;;
        esac
      fi
      if [[ "$RUN_PY_NOW" == "1" ]]; then
        case "$(uname -s)" in
          Darwin|Linux|MINGW*|MSYS*|CYGWIN*)
            log "Ejecutando Python main ahora en primer plano (retries=${PY_RETRIES}, delay=${PY_RETRY_DELAY}s)..."
            run_args=("${ROOT_DIR}/scripts/run-python-main.sh" "--retries" "$PY_RETRIES" "--retry-delay" "$PY_RETRY_DELAY")
            if [[ -n "$PY_BIN" ]]; then run_args+=("--python" "$PY_BIN"); fi
            if [[ -n "$CONDA_ENV" ]]; then run_args+=("--conda-env" "$CONDA_ENV"); fi
            bash "${run_args[@]}"
            ;;
          *)
            log "Sistema no reconocido para ejecución de Python."
            ;;
        esac
      fi
      ;;
    down)
      if has_cmd docker && docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        docker_down
      else
        preview_down
      fi
      ;;
    status) status ;;
    logs) logs ;;
    *) usage; exit 1 ;;
  esac
}

main "$@"
