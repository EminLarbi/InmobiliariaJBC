Param(
  [string]$Port = "80",
  [switch]$NoDocker
)

$ErrorActionPreference = "Stop"

$RootDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$DeployPs1 = Join-Path $RootDir "scripts/deploy.ps1"

if (-not (Test-Path $DeployPs1)) { throw "No se encuentra $DeployPs1" }

# Construir argumentos para el arranque con defaults requeridos
$argsList = @(
  "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$DeployPs1`"",
  "up", "-Port", "$Port",
  "-SetupPythonDaily", "-PythonTime", "00:00",
  "-PythonRetries", "3", "-PythonRetryDelaySec", "300",
  "-CondaEnv", "scrapper_env",
  "-SkipPythonNow"
)
if ($NoDocker) { $argsList += "-Detach" } # si no docker, preferimos preview en background

# Nota: Si Docker está disponible al arrancar, deploy.ps1 usará Docker por defecto.

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument ($argsList -join ' ')
$trigger = New-ScheduledTaskTrigger -AtLogOn
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

$taskName = "InmobiliariaJBC_AutoStart"
try {
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue | Out-Null
} catch {}

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings | Out-Null
Write-Host "Tarea programada creada: $taskName. Puerto: $Port"
Write-Host "Se ejecutará al iniciar sesión del usuario actual."
