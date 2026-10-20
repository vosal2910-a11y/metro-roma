@echo off
chcp 65001 >nul
title Roma Transit Express - Avvio Rapido

echo ===================================================================
echo             ROMA TRANSIT EXPRESS - ATAC REAL-TIME APP              
echo ===================================================================
echo.

:: Configura PATH se Node non e gia nel path globale
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    if exist "%USERPROFILE%\.unsloth\node\node.exe" (
        set "PATH=%USERPROFILE%\.unsloth\node;%PATH%"
    )
)

:: Verifica installazione Node.js
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERRORE] Node.js non e stato trovato nel sistema!
    echo Assicurati che Node.js sia installato e presente nel PATH.
    pause
    exit /b 1
)

:: Verifica dipendenze backend
if not exist "node_modules" (
    echo [1/3] Installazione dipendenze backend...
    call npm install
)

:: Verifica database GTFS locale
if not exist "data\roma_gtfs.db" (
    echo [2/3] Sincronizzazione GTFS ufficiale Roma Mobilita in corso...
    call npm run sync-gtfs
) else (
    echo [OK] Database GTFS di Roma presente in data\roma_gtfs.db
)

:: Verifica build frontend
if not exist "frontend\dist\index.html" (
    echo [3/3] Compilazione frontend React Material Design 3...
    cd frontend
    if not exist "node_modules" call npm install
    call npm run build
    cd ..
) else (
    echo [OK] Frontend compilato pronto in frontend\dist
)

echo.
echo ===================================================================
echo   Avvio server su http://localhost:3001...
echo   Apertura automatica del browser in corso!
echo ===================================================================
echo.

start "" "http://localhost:3001"
node server.js
