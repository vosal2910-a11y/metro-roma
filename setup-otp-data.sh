#!/usr/bin/env bash
set -e

mkdir -p otp-data
echo "[1/2] Scaricamento GTFS Statico Ufficiale Roma Mobilita per OpenTripPlanner..."
curl -L "https://romamobilita.it/sites/default/files/rome_static_gtfs.zip" -o otp-data/rome_static_gtfs.zip

echo "[2/2] Scaricamento estratto OpenStreetMap Lazio (.osm.pbf) da Geofabrik..."
curl -L "https://download.geofabrik.de/europe/italy/centro-latest.osm.pbf" -o otp-data/centro-latest.osm.pbf

echo "File pronti in ./otp-data! Ora puoi costruire il grafo OTP2 con:"
echo "docker run --rm -v $(pwd)/otp-data:/var/opentripplanner -e JAVA_TOOL_OPTIONS='-Xmx4G' opentripplanner/opentripplanner:2.5.0 --build --save"
