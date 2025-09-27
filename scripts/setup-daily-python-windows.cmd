@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM Configuración por defecto
set "TIME=00:00"
set "CONDA_ENV="
set "PYTHON_PATH="
set "RETRIES=3"
set "RETRY_DELAY=300"
set "TASK_NAME=InmobiliariaJBC_PythonDaily"

REM Ruta absoluta del repo (carpeta padre de este script)
set "ROOT_DIR=%~dp0.."
for %%I in ("%ROOT_DIR%") do set "ROOT_DIR=%%~fI"

REM Parseo sencillo de argumentos (acepta -X o --x)
:parse
if "%~1"=="" goto build
if /I "%~1"=="-Time"        (set "TIME=%~2" & shift & shift & goto parse)
if /I "%~1"=="--time"       (set "TIME=%~2" & shift & shift & goto parse)
if /I "%~1"=="-CondaEnv"    (set "CONDA_ENV=%~2" & shift & shift & goto parse)
if /I "%~1"=="--conda-env"  (set "CONDA_ENV=%~2" & shift & shift & goto parse)
if /I "%~1"=="-PythonPath"  (set "PYTHON_PATH=%~2" & shift & shift & goto parse)
if /I "%~1"=="--python"     (set "PYTHON_PATH=%~2" & shift & shift & goto parse)
if /I "%~1"=="-Retries"     (set "RETRIES=%~2" & shift & shift & goto parse)
if /I "%~1"=="--retries"    (set "RETRIES=%~2" & shift & shift & goto parse)
if /I "%~1"=="-RetryDelaySec" (set "RETRY_DELAY=%~2" & shift & shift & goto parse)
if /I "%~1"=="--retry-delay"  (set "RETRY_DELAY=%~2" & shift & shift & goto parse)
echo [setup][error] Argumento no reconocido: %~1>&2
goto usage

:build
REM Validar formato de hora HH:MM (24h)
echo %TIME% | findstr /R "^[0-2][0-9]:[0-5][0-9]$" >NUL || (
  echo [setup][error] Hora invalida: %TIME% ^(usa HH:MM 24h^)>&2
  exit /b 1
)

set "TASK_EXE=%ROOT_DIR%\scripts\run-python-main.cmd"
if not exist "%TASK_EXE%" (
  echo [setup][error] No se encontro %TASK_EXE%>&2
  exit /b 1
)

REM Construir comando de tarea con comillas escapadas para schtasks (usa \" ... \")
set "TR=\"%TASK_EXE%\""
if defined CONDA_ENV   set "TR=!TR! --conda-env \"%CONDA_ENV%\""
if defined PYTHON_PATH set "TR=!TR! --python \"%PYTHON_PATH%\""
set "TR=!TR! --retries %RETRIES% --retry-delay %RETRY_DELAY%"

echo [setup] Creando/actualizando tarea diaria "%TASK_NAME%" a las %TIME%
REM /RL HIGHEST requiere permisos; /F fuerza sobreescritura si ya existe
schtasks /Create /TN "%TASK_NAME%" /SC DAILY /ST %TIME% /TR "%TR%" /RL HIGHEST /F
if errorlevel 1 (
  echo [setup][error] Fallo al crear/actualizar la tarea.>&2
  exit /b 1
)

echo [setup] Tarea programada creada: %TASK_NAME%
echo [setup] Ejecuta: %TASK_EXE% ^(via Git Bash^) con retries=%RETRIES% delay=%RETRY_DELAY%s
echo [setup] Para ver/editar: abre el Programador de tareas de Windows
exit /b 0

:usage
echo Uso: scripts\setup-daily-python-windows.cmd -Time HH:MM ^[-CondaEnv nombre ^| -PythonPath ruta^] ^[-Retries N] ^[-RetryDelaySec S]
exit /b 1

