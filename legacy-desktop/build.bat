@echo off
:: ============================================================
::  Diplomator - Script de build para Windows
::  Ejecutar desde la carpeta del proyecto: build.bat
:: ============================================================

title Diplomator - Build

echo.
echo  ============================================================
echo   Diplomator - Generando ejecutable para Windows
echo  ============================================================
echo.

:: Verificar Python
python --version >nul 2>&1
if errorlevel 1 (
    echo  ERROR: Python no encontrado. Instala Python desde python.org
    pause
    exit /b 1
)

:: Instalar/actualizar PyInstaller
echo  [1/3] Instalando PyInstaller...
pip install pyinstaller --quiet --upgrade
if errorlevel 1 (
    echo  ERROR instalando PyInstaller.
    pause
    exit /b 1
)
echo        OK
echo.

:: Limpiar builds anteriores
echo  [2/3] Limpiando builds anteriores...
if exist "dist" rmdir /s /q "dist"
if exist "build" rmdir /s /q "build"
if exist "Diplomator.spec" del "Diplomator.spec"
echo        OK
echo.

:: Construir el .exe
echo  [3/3] Construyendo Diplomator.exe ...
echo        (puede tardar 1-2 minutos, es normal)
echo.

pyinstaller ^
    --onefile ^
    --noconsole ^
    --name "Diplomator" ^
    --add-data "apps\diplomator\index.html;apps\diplomator" ^
    --icon NONE ^
    main.py

if errorlevel 1 (
    echo.
    echo  ERROR durante el build. Revisa los mensajes de arriba.
    pause
    exit /b 1
)

echo.
echo  ============================================================
echo   BUILD COMPLETADO
echo  ============================================================
echo.
echo   Archivo generado:
echo     dist\Diplomator.exe
echo.
echo   Para distribuir, manda a la usuaria:
echo     - dist\Diplomator.exe
echo.
echo   Al abrirlo, la aplicacion crea automaticamente:
echo     - Diplomator_Data\state.json
echo     - Diplomator_Data\license.txt
echo     - Diplomator_Data\backend_server.txt
echo     - Diplomator_Data\exports
echo     - Diplomator_Data\backups
echo     - Diplomator_Data\logs
echo.
echo  ============================================================
echo.

:: Abrir la carpeta dist automaticamente
explorer dist

pause


