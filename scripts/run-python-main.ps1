Param(
  [string]$PythonPath,
  [string]$CondaEnv,
  [string]$EnvPath,
  [int]$Retries = 3,
  [int]$RetryDelaySec = 300
)

$ErrorActionPreference = 'Stop'

function Resolve-PythonFromEnvPath {
  param([string]$Path)
  if ([string]::IsNullOrWhiteSpace($Path)) { return $null }
  # Permitir que se pase directamente el ejecutable
  if (Test-Path -LiteralPath $Path -PathType Leaf) { return $Path }
  $candidates = @(
    (Join-Path $Path 'python.exe'),
    (Join-Path (Join-Path $Path 'Scripts') 'python.exe'),
    (Join-Path (Join-Path $Path 'bin') 'python'),
    (Join-Path $Path 'python')
  )
  foreach ($p in $candidates) { if (Test-Path -LiteralPath $p -PathType Leaf) { return $p } }
  throw "No se encontró el ejecutable de Python en -EnvPath '$Path'"
}

function Get-PythonCmd {
  param([string]$Override,[string]$EnvName,[string]$EnvPath)
  if ($EnvName) {
    if ($null -ne (Get-Command conda -ErrorAction SilentlyContinue)) { return @('conda','run','-n',$EnvName,'python') }
    if ($null -ne (Get-Command micromamba -ErrorAction SilentlyContinue)) { return @('micromamba','run','-n',$EnvName,'python') }
    throw "No se encontró 'conda' ni 'micromamba' para -CondaEnv $EnvName"
  }
  if ($EnvPath) {
    $exeFromEnv = Resolve-PythonFromEnvPath -Path $EnvPath
    if ($exeFromEnv) { return @($exeFromEnv) }
  }
  if ($Override) { return @($Override) }
  if ($null -ne (Get-Command python -ErrorAction SilentlyContinue)) { return @('python') }
  if ($null -ne (Get-Command py -ErrorAction SilentlyContinue)) { return @('py','-3') }
  throw "No se encontró Python. Añade Python al PATH, usa 'py -3' o especifica -PythonPath o -EnvPath"
}

$RootDir = (Resolve-Path (Join-Path $PSScriptRoot ".."))
$PyDir = Join-Path $RootDir "InmobiliariaJBCPython"
$LogDir = Join-Path $env:LOCALAPPDATA "InmobiliariaJBC\logs"
New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
$LogPath = Join-Path $LogDir "python-daily.log"
 # Perfil UC estable para Windows (evita bloqueos intermitentes)
 $UcProfileDir = Join-Path $env:LOCALAPPDATA "InmobiliariaJBC\uc-profile"
 New-Item -ItemType Directory -Path $UcProfileDir -Force | Out-Null

$pythonCmd = Get-PythonCmd -Override $PythonPath -EnvName $CondaEnv -EnvPath $EnvPath
$exe = $pythonCmd[0]
$preArgs = @()
if ($pythonCmd.Count -gt 1) { $preArgs = $pythonCmd[1..($pythonCmd.Count-1)] }

Push-Location $PyDir
try {
  $attempt = 1
  $exitCode = 0
  do {
    Add-Content -Path $LogPath -Value ("`n===== $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') intento $attempt =====")

    # Preparar proceso para capturar salida y código de salida correctamente
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $exe
    $psi.WorkingDirectory = $PyDir
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError  = $true
    # Variables de entorno adicionales para estabilidad/diagnóstico
    $psi.EnvironmentVariables['PYTHONUNBUFFERED'] = '1'
    if (-not $psi.EnvironmentVariables.ContainsKey('UC_USER_DATA_DIR')) {
      $psi.EnvironmentVariables['UC_USER_DATA_DIR'] = $UcProfileDir
    }
    if ($env:UC_LOG_LEVEL) { $psi.EnvironmentVariables['UC_LOG_LEVEL'] = $env:UC_LOG_LEVEL }

    # Compatibilidad: PowerShell 7+ tiene ArgumentList; en Windows PowerShell 5.1 no.
    $hasArgumentList = ($psi | Get-Member -Name 'ArgumentList' -MemberType Property -ErrorAction SilentlyContinue) -ne $null
    if ($hasArgumentList) {
      foreach ($a in $preArgs) { [void]$psi.ArgumentList.Add($a) }
      [void]$psi.ArgumentList.Add('main.py')
    } else {
      # Construir cadena de argumentos con quoting básico
      $allArgs = @()
      foreach ($a in ($preArgs + @('main.py'))) {
        if ($a -match '[\s\"]') { $allArgs += '"' + ($a -replace '"','\"') + '"' } else { $allArgs += $a }
      }
      $psi.Arguments = ($allArgs -join ' ')
    }
    $proc = New-Object System.Diagnostics.Process
    $proc.StartInfo = $psi
    $null = $proc.Start()
    $stdout = $proc.StandardOutput.ReadToEnd()
    $stderr = $proc.StandardError.ReadToEnd()
    $proc.WaitForExit()
    $exitCode = $proc.ExitCode

    # Escribir logs y también a consola
    if ($stdout) { $stdout | Tee-Object -FilePath $LogPath -Append }
    if ($stderr) { $stderr | Tee-Object -FilePath $LogPath -Append | Write-Error }

    if ($exitCode -eq 0) {
      Add-Content -Path $LogPath -Value ("Ejecución exitosa en el intento $attempt")
      break
    }
    if ($attempt -ge $Retries) {
      Add-Content -Path $LogPath -Value ("Falló tras $attempt intentos. Último código: $exitCode")
      break
    }
    Write-Host "[python-daily] Intento $attempt falló (code=$exitCode). Reintentando en ${RetryDelaySec}s..."
    Start-Sleep -Seconds $RetryDelaySec
    $attempt++
  } while ($true)
}
finally {
  Pop-Location
}
