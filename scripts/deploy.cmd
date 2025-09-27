@echo off
setlocal

:: Buscar Git Bash (evitar WSL bash.exe)
set "BASH_EXE="
for %%G in (
  "%ProgramFiles%\Git\bin\bash.exe"
  "%ProgramFiles%\Git\usr\bin\bash.exe"
  "%ProgramW6432%\Git\bin\bash.exe"
  "%ProgramW6432%\Git\usr\bin\bash.exe"
  "%ProgramFiles(x86)%\Git\bin\bash.exe"
  "%ProgramFiles(x86)%\Git\usr\bin\bash.exe"
) do (
  if exist "%%~G" set "BASH_EXE=%%~G"
)
if not defined BASH_EXE (
  echo [deploy][error] No se encontró bash.exe. Instala Git for Windows o usa WSL.>&2
  exit /b 1
)

:: Ruta del repo (carpeta padre de este script)
set "ROOT_DIR=%~dp0.."
for %%I in ("%ROOT_DIR%") do set "ROOT_DIR=%%~fI"

:: Ejecutar el script con Git Bash ubicándonos en la ruta POSIX del repo
"%BASH_EXE%" -lc "cd \"$(/usr/bin/cygpath -u \"%ROOT_DIR%\")\" && bash ./scripts/deploy.sh %*"
exit /b %ERRORLEVEL%
