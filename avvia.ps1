# Roma Transit Express - Script di Avvio Rapido PowerShell

Write-Host "===================================================================" -ForegroundColor Red
Write-Host "            ROMA TRANSIT EXPRESS - ATAC REAL-TIME APP              " -ForegroundColor Yellow
Write-Host "===================================================================" -ForegroundColor Red
Write-Host ""

# Configura PATH se Node non e nel PATH della sessione corrente
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    if (Test-Path "$env:USERPROFILE\.unsloth\node\node.exe") {
        $env:PATH = "$env:USERPROFILE\.unsloth\node;$env:PATH"
    }
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js non trovato nel sistema. Assicurati che Node.js sia installato."
    Read-Host "Premi Invio per uscire..."
    exit 1
}

# 1. Verifica dipendenze backend
if (-not (Test-Path "node_modules")) {
    Write-Host "[1/3] Installazione dipendenze backend..." -ForegroundColor Cyan
    npm install
}

# 2. Verifica database GTFS
if (-not (Test-Path "data/roma_gtfs.db")) {
    Write-Host "[2/3] Sincronizzazione GTFS ufficiale Roma Mobilita..." -ForegroundColor Cyan
    npm run sync-gtfs
} else {
    Write-Host "[OK] Database GTFS di Roma presente in data/roma_gtfs.db" -ForegroundColor Green
}

# 3. Verifica build frontend
if (-not (Test-Path "frontend/dist/index.html")) {
    Write-Host "[3/3] Compilazione frontend React Material Design 3..." -ForegroundColor Cyan
    Push-Location frontend
    if (-not (Test-Path "node_modules")) { npm install }
    npm run build
    Pop-Location
} else {
    Write-Host "[OK] Frontend compilato pronto in frontend/dist" -ForegroundColor Green
}

Write-Host ""
Write-Host "===================================================================" -ForegroundColor Green
Write-Host "  Avvio server su http://localhost:3001..." -ForegroundColor Yellow
Write-Host "  Apertura automatica del browser in corso!" -ForegroundColor Cyan
Write-Host "===================================================================" -ForegroundColor Green
Write-Host ""

Start-Process "http://localhost:3001"
node server.js
