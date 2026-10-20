#!/usr/bin/env bash
set -e

echo "==================================================================="
echo "            ROMA TRANSIT EXPRESS — ATAC REAL-TIME APP              "
echo "==================================================================="
echo ""

if [ ! -d "node_modules" ]; then
    echo "[1/3] Installazione dipendenze backend..."
    npm install
fi

if [ ! -f "data/roma_gtfs.db" ]; then
    echo "[2/3] Sincronizzazione GTFS ufficiale Roma Mobilità..."
    npm run sync-gtfs
else
    echo "[OK] Database GTFS di Roma presente in data/roma_gtfs.db"
fi

if [ ! -f "frontend/dist/index.html" ]; then
    echo "[3/3] Compilazione frontend React Material Design 3..."
    cd frontend
    [ ! -d "node_modules" ] && npm install
    npm run build
    cd ..
else
    echo "[OK] Frontend compilato pronto in frontend/dist"
fi

echo ""
echo "==================================================================="
echo "  Avvio server su http://localhost:3001..."
echo "==================================================================="
echo ""

npm start
