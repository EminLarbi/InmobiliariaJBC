Param(
  [Parameter(Position=0)] [string]$Command = "up",
  [string]$Port = "80",
  [switch]$Detach,
  [switch]$SetupPythonDaily,
  [string]$PythonTime = '00:00',
  [string]$PythonPath,
  [string]$EnvPath,
  [string]$CondaEnv = 'scrapper_env',
  [int]$PythonRetries = 3,
  [Alias("PythonRetryDelay")] [int]$PythonRetryDelaySec = 300,
  [switch]$SkipPythonNow,
  [switch]$ForceBuild,
  [switch]$ForceImageBuild
)

$ErrorActionPreference = "Stop"

function Write-Log($msg) { Write-Host "[deploy] $msg" }
function Write-Err($msg) { Write-Error "[deploy][error] $msg" }

# Defaults for switches: enable if not explicitly provided
if (-not $PSBoundParameters.ContainsKey('SetupPythonDaily')) { $SetupPythonDaily = $true }
if (-not $PSBoundParameters.ContainsKey('SkipPythonNow'))   { $SkipPythonNow   = $true }

$RootDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$BuildDir = Join-Path $RootDir "build"
$AppName = "inmobiliaria-jbc"
# Construir el nombre de imagen sin interpolaciÃ³n para evitar ambigÃ¼edades
$ImageName = ($AppName + ":prod")
$ContainerName = $AppName
$PreviewPidPath = Join-Path $RootDir "preview.pid"
$PreviewLogPath = Join-Path $RootDir "preview.log"

function Has-Cmd($name) {
  return $null -ne (Get-Command $name -ErrorAction SilentlyContinue)
}

function Docker-Daemon-Running() {
  if (-not (Has-Cmd docker)) { return $false }
  try {
    # Fast, quiet check: returns non-zero if daemon is unreachable
    $null = & docker version --format '{{.Server.Version}}' 2>$null
    return ($LASTEXITCODE -eq 0)
  } catch { return $false }
}

# Calcula un fingerprint de fuentes relevantes para decidir si reconstruir imagen Docker
function Get-Source-Fingerprint() {
  $candidates = @(
    (Join-Path $RootDir 'docker/Dockerfile'),
    (Join-Path $RootDir 'docker/nginx.conf'),
    (Join-Path $RootDir 'package.json'),
    (Join-Path $RootDir 'package-lock.json'),
    (Join-Path $RootDir 'vite.config.ts'),
    (Join-Path $RootDir 'index.html'),
    (Join-Path $RootDir 'src'),
    (Join-Path $RootDir 'public')
  )
  $files = @()
  foreach ($p in $candidates) {
    if (Test-Path $p) {
      $item = Get-Item $p
      if ($item.PSIsContainer) {
        $files += (Get-ChildItem -Path $p -Recurse -File | ForEach-Object { $_.FullName })
      } else {
        $files += $item.FullName
      }
    }
  }
  $files = $files | Sort-Object
  if ($files.Count -eq 0) { return '' }
  $sb = New-Object System.Text.StringBuilder
  foreach ($f in $files) {
    try { $h = (Get-FileHash -Algorithm SHA256 -Path $f).Hash } catch { $h = '' }
    [void]$sb.AppendLine("$f|$h")
  }
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($sb.ToString())
  $sha = [System.Security.Cryptography.SHA256]::Create()
  $hashBytes = $sha.ComputeHash($bytes)
  return -join ($hashBytes | ForEach-Object { $_.ToString('x2') })
}

# Recupera el label de fingerprint de una imagen si existe
function Get-Image-Fingerprint($image) {
  try {
    $fmt = '{{ index .Config.Labels "jbc.build.fingerprint" }}'
    $out = & docker image inspect --format $fmt $image 2>$null
    if ($LASTEXITCODE -ne 0) { return $null }
    $val = ($out | Select-Object -First 1)
    if ($null -eq $val) { return $null }
    $val = $val.Trim()
    if ([string]::IsNullOrWhiteSpace($val) -or $val -eq '<no value>') { return $null }
    return $val
  } catch { return $null }
}

function Check-Node() {
  if (-not (Has-Cmd node) -or -not (Has-Cmd npm)) {
    Write-Err "Se requiere Node.js y npm. Instala Node 18+ desde https://nodejs.org/"
    exit 1
  }
  $major = [int]((node -p "process.versions.node.split('.')[0]").Trim())
  if ($major -lt 18) {
    Write-Err "Se requiere Node.js >= 18. VersiÃ³n actual: $(node -v)"
    exit 1
  }
}

function Build-App() {
  Check-Node
  # Si ya existe un build y no se fuerza, omitir recompilar
  if (-not $ForceBuild) {
    if (Test-Path $BuildDir) {
      $existing = Get-ChildItem -Path $BuildDir -Recurse -File -ErrorAction SilentlyContinue | Select-Object -First 1
      if ($null -ne $existing) {
        Write-Log "Build existente encontrado en '$BuildDir'. Omitiendo 'npm run build' (use -ForceBuild para forzar)."
        return
      }
    }
  }
  Write-Log "Instalando dependencias..."
  Push-Location $RootDir
  if (Test-Path (Join-Path $RootDir "package-lock.json")) {
    npm ci
  } else {
    npm install
  }
  Write-Log "Construyendo aplicaciÃ³n (salida en '$BuildDir')..."
  npm run build
  Pop-Location
}

function Docker-Up() {
  if (-not (Has-Cmd docker)) {
    Write-Err "Docker no estÃ¡ disponible. Usa 'preview' o instala Docker Desktop."
    exit 1
  }
  if (-not (Docker-Daemon-Running)) {
    Write-Log "Docker CLI detectado pero el daemon no responde. Usando 'preview' en su lugar."
    Preview-Up
    return
  }
  Build-App
  # Validaciones rÃ¡pidas para evitar errores confusos en docker
  if ([string]::IsNullOrWhiteSpace($ImageName)) { Write-Err "ImageName estÃ¡ vacÃ­o"; exit 1 }
  if ([string]::IsNullOrWhiteSpace($Port))      { Write-Err "Port estÃ¡ vacÃ­o"; exit 1 }

  $srcFp = Get-Source-Fingerprint
  $skipBuild = $false
  if (-not $ForceImageBuild) {
    $imgFp = Get-Image-Fingerprint $ImageName
    if ($imgFp -and $imgFp -eq $srcFp) { $skipBuild = $true }
  }
  Write-Log "Construyendo imagen Docker '$ImageName'..."
  # Cuidar rutas con espacios en Windows. Usar llamada por tokens evita problemas de quoting.
  $dockerfilePath = Join-Path $RootDir "docker/Dockerfile"
  $buildArgs = @('build','-t', $ImageName, '-f', $dockerfilePath, '--label', ("jbc.build.fingerprint=" + $srcFp), $RootDir)
  if ($skipBuild) {
    Write-Log "Imagen '$ImageName' ya actual (fingerprint=$srcFp). Omitiendo 'docker build'."
    $buildArgs = @('image','inspect', $ImageName)
  }
  if ($env:DEPLOY_DEBUG) { Write-Log ("docker " + ($buildArgs -join ' ')) }
  & docker @buildArgs
  if ($LASTEXITCODE -ne 0) {
    Write-Err "FallÃ³ 'docker build' (exit=$LASTEXITCODE)"
    exit $LASTEXITCODE
  }
  if ((docker ps -a --format '{{.Names}}') -contains $ContainerName) {
    Write-Log "Eliminando contenedor existente '$ContainerName'..."
    docker rm -f $ContainerName | Out-Null
  }
  Write-Log "Levantando contenedor '$ContainerName' en http://localhost:$Port ..."
  # Evitar problemas de splatting/expansiÃ³n en Windows PowerShell 5.1 usando invocaciÃ³n directa
  $dockerRunCmd = @(
    'run','-d','--restart','unless-stopped','--name',"$ContainerName",'-p',"$Port:80","$ImageName"
  )
  if ($env:DEPLOY_DEBUG) { Write-Log ("docker " + ($dockerRunCmd -join ' ')) }
  # Llamada directa sin splatting array para compatibilidad con Windows PowerShell
  docker run -d --restart unless-stopped --name "$ContainerName" -p "$Port`:80" "$ImageName" | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Err ("FallÃ³ 'docker run' (exit=$LASTEXITCODE). Comando: docker " + ($dockerRunCmd -join ' '))
    Write-Err "Verifica que la imagen '$ImageName' existe y que el puerto $Port no estÃ© en uso."
    exit $LASTEXITCODE
  }
  Write-Log "Listo. Accede en http://localhost:$Port"
}

function Docker-Down() {
  if (-not (Has-Cmd docker)) { Write-Err "Docker no disponible"; exit 1 }
  if (-not (Docker-Daemon-Running)) { Write-Log "Docker daemon no disponible. Nada que detener."; return }
  if ((docker ps -a --format '{{.Names}}') -contains $ContainerName) {
    Write-Log "Parando y eliminando contenedor '$ContainerName'..."
    docker rm -f $ContainerName | Out-Null
    Write-Log "Contenedor eliminado."
  } else { Write-Log "No hay contenedor '$ContainerName'." }
}

function Preview-Up() {
  Check-Node
  Build-App
  Write-Log "Sirviendo build con 'vite preview' en http://localhost:$Port ..."
  if ($Detach) {
    if (Test-Path $PreviewPidPath) { Remove-Item $PreviewPidPath -Force -ErrorAction SilentlyContinue }
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "npx"
    $psi.ArgumentList.Add("--yes")
    $psi.ArgumentList.Add("vite")
    $psi.ArgumentList.Add("preview")
    $psi.ArgumentList.Add("--host");        $psi.ArgumentList.Add("0.0.0.0")
    $psi.ArgumentList.Add("--strictPort")
    $psi.ArgumentList.Add("--port");        $psi.ArgumentList.Add($Port)
    $psi.ArgumentList.Add("--outDir");      $psi.ArgumentList.Add($BuildDir)
    $psi.WorkingDirectory = $RootDir
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError  = $true
    $proc = New-Object System.Diagnostics.Process
    $proc.StartInfo = $psi
    $null = $proc.Start()
    $proc.Id | Out-File -Encoding ascii -NoNewline $PreviewPidPath
    Start-Job -ScriptBlock { param($p,$log) Get-Process -Id $p -ErrorAction SilentlyContinue | ForEach-Object { $_.WaitForExit() } } -ArgumentList $proc.Id, $PreviewLogPath | Out-Null
    Write-Log "Preview en background (PID $($proc.Id)). Logs en $PreviewLogPath"
  } else {
    Push-Location $RootDir
    npx --yes vite preview --host 0.0.0.0 --strictPort --port $Port --outDir $BuildDir
    Pop-Location
  }
}

function Preview-Down() {
  if (Test-Path $PreviewPidPath) {
    $previewPid = Get-Content $PreviewPidPath -ErrorAction SilentlyContinue
    if ($previewPid) {
      try { Stop-Process -Id [int]$previewPid -Force -ErrorAction SilentlyContinue } catch {}
    }
    Remove-Item $PreviewPidPath -Force -ErrorAction SilentlyContinue
    Write-Log "Preview detenido."
  } else { Write-Log "No hay preview en background." }
}

function Status() {
  if (Has-Cmd docker) {
    if (Docker-Daemon-Running) {
      if ((docker ps --format '{{.Names}}') -contains $ContainerName) {
        Write-Log "Estado Docker: ejecutÃ¡ndose ($ContainerName) en puerto $Port"
      } else { Write-Log "Estado Docker: no ejecutÃ¡ndose" }
    } else { Write-Log "Estado Docker: CLI presente, daemon no disponible" }
  }
  if (Test-Path $PreviewPidPath) {
    $previewPid = Get-Content $PreviewPidPath -ErrorAction SilentlyContinue
    if ($previewPid -and (Get-Process -Id $previewPid -ErrorAction SilentlyContinue)) {
    }
  }
}

function Logs() {
  if (Has-Cmd docker -and (Docker-Daemon-Running) -and ((docker ps --format '{{.Names}}') -contains $ContainerName)) {
    docker logs -f $ContainerName
  } elseif (Test-Path $PreviewLogPath) {
    Get-Content -Path $PreviewLogPath -Wait -Tail 200
  } else {
    Write-Log "No hay logs disponibles."
  }
}

switch ($Command) {
  "build"  { Build-App }
  "up"     {
    $useDocker = (Has-Cmd docker) -and (Docker-Daemon-Running)
    if ($useDocker) { Docker-Up } else { Preview-Up }
    if ($SetupPythonDaily) {
      $setup = Join-Path $RootDir "scripts/setup-daily-python-windows.ps1"
      if (-not (Test-Path $setup)) { Write-Err "No se encontrÃ³ $setup"; exit 1 }
      Write-Log "Configurando tarea diaria de Python a las $PythonTime (retries=$PythonRetries, delay=${PythonRetryDelaySec}s)..."
      # Usar splatting con parÃ¡metros con nombre para evitar problemas de binding
      $setupParams = @{ Time = $PythonTime; Retries = $PythonRetries; RetryDelaySec = $PythonRetryDelaySec }
      if ($PythonPath) { $setupParams.PythonPath = $PythonPath }
      if ($EnvPath)   { $setupParams.EnvPath   = $EnvPath }
      if ($CondaEnv)  { $setupParams.CondaEnv  = $CondaEnv }
      & $setup @setupParams
    }
    if (-not $SkipPythonNow) {
      $runner = Join-Path $RootDir "scripts/run-python-main.ps1"
      if (-not (Test-Path $runner)) { Write-Err "No se encontrÃ³ $runner"; exit 1 }
      Write-Log "Ejecutando Python main ahora en primer plano (Retries=$PythonRetries, Delay=${PythonRetryDelaySec}s)..."
      # Usar splatting con hashtable para evitar ambigÃ¼edades de binding en Windows PowerShell 5.1
      $runnerParams = @{ 
        Retries       = [int]$PythonRetries
        RetryDelaySec = [int]$PythonRetryDelaySec
      }
      if ($PythonPath) { $runnerParams.PythonPath = $PythonPath }
      if ($EnvPath)    { $runnerParams.EnvPath    = $EnvPath }
      if ($CondaEnv)   { $runnerParams.CondaEnv   = $CondaEnv }
      if ($env:DEPLOY_DEBUG) {
        $dbg = @()
        foreach ($k in $runnerParams.Keys) { $dbg += ("-$k " + $runnerParams[$k]) }
        Write-Log ("Python runner params: " + ($dbg -join ' '))
      }
      & $runner @runnerParams
    }
  }
  "down"   {
    if (Has-Cmd docker -and (Docker-Daemon-Running) -and ((docker ps -a --format '{{.Names}}') -contains $ContainerName)) { Docker-Down } else { Preview-Down }
  }
  "status" { Status }
  "logs"   { Logs }
  default  { Write-Host "Uso: scripts/deploy.ps1 [build|up|down|status|logs] [-Port 80] [-Detach] [-SetupPythonDaily] [-PythonTime HH:mm] [-PythonPath <ruta-python>] [-EnvPath <ruta-env>] [-CondaEnv <nombre>] [-PythonRetries N] [-PythonRetryDelaySec s] [-SkipPythonNow] [-ForceBuild] [-ForceImageBuild]. Nota: en PowerShell use '-' (una raya), no '--'."; exit 1 }
}
