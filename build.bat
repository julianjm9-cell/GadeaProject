@echo off
:: ============================================================
::  Gadea Project - Script de build para Windows
::  Ejecutar desde la carpeta del proyecto: build.bat
:: ============================================================

title Gadea Project - Build

echo.
echo  ============================================================
echo   Gadea Project - Generando ejecutable para Windows
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
if exist "GadeaProject.spec" del "GadeaProject.spec"
echo        OK
echo.

:: Construir el .exe
echo  [3/3] Construyendo GadeaProject.exe ...
echo        (puede tardar 1-2 minutos, es normal)
echo.

pyinstaller ^
    --onefile ^
    --noconsole ^
    --name "GadeaProject" ^
    --add-data "GadeaProject.html;." ^
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
echo     dist\GadeaProject.exe
echo.
echo   Para distribuir, manda a la usuaria:
echo     - dist\GadeaProject.exe
echo.
echo   Al abrirlo, la aplicacion crea automaticamente:
echo     - GadeaProject_Data\state.json
echo     - GadeaProject_Data\apikey.txt
echo     - GadeaProject_Data\exports
echo     - GadeaProject_Data\backups
echo     - GadeaProject_Data\logs
echo.
echo  ============================================================
echo.

:: Abrir la carpeta dist automaticamente
explorer dist

pause
