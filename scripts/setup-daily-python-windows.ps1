Param(
  [string]$Time = "00:00",
  [string]$PythonPath,
  [string]$CondaEnv,
  [string]$EnvPath,
  [int]$Retries = 3,
  [int]$RetryDelaySec = 300
)

$ErrorActionPreference = 'Stop'

function Parse-Time([string]$t) {
  if (-not ($t -match '^(?<h>[0-1][0-9]|2[0-3]):(?<m>[0-5][0-9])$')) {
    throw "Hora inválida: $t (uso HH:MM 24h)"
  }
  $h = [int]$Matches['h']
  $m = [int]$Matches['m']
  # Construye DateTime para hoy con esa hora (la fecha no importa para el trigger)
  return (Get-Date).Date.AddHours($h).AddMinutes($m)
}

$RootDir = (Resolve-Path (Join-Path $PSScriptRoot ".."))
$RootDir = $RootDir.Path
$Runner = Join-Path $RootDir "scripts/run-python-main.ps1"
if (-not (Test-Path $Runner)) { throw "No se encuentra $Runner" }

$taskName = "InmobiliariaJBC_PythonDaily"

$timeDt = Parse-Time $Time

# Construir argumentos para powershell.exe
$argList = @('-NoProfile','-ExecutionPolicy','Bypass','-File',"`"$Runner`"")
if ($PythonPath) { $argList += @('-PythonPath',"`"$PythonPath`"") }
if ($CondaEnv)  { $argList += @('-CondaEnv',"`"$CondaEnv`"") }
if ($EnvPath)   { $argList += @('-EnvPath',  "`"$EnvPath`"") }
$argList += @('-Retries',$Retries,'-RetryDelaySec',$RetryDelaySec)
$argumentString = ($argList -join ' ')

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $argumentString -WorkingDirectory $RootDir
$trigger = New-ScheduledTaskTrigger -Daily -At $timeDt
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -WakeToRun

try { Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue | Out-Null } catch {}
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings | Out-Null

Write-Host "Tarea programada creada: $taskName"
Write-Host "Se ejecutará diariamente a las $Time (StartWhenAvailable/WakeToRun habilitados)"
Write-Host "Para logs, ver %LOCALAPPDATA%\InmobiliariaJBC\logs\python-daily.log"
