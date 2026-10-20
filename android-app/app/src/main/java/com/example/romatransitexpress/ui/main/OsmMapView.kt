package com.example.romatransitexpress.ui.main

import android.annotation.SuppressLint
import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import com.example.romatransitexpress.data.TransitStop
import org.json.JSONArray
import org.json.JSONObject

class AndroidMapBridge(
    private val onStopClickedId: (String) -> Unit
) {
    private val handler = Handler(Looper.getMainLooper())

    @JavascriptInterface
    fun onStopClicked(stopId: String) {
        handler.post {
            onStopClickedId(stopId)
        }
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun OsmMapView(
    modifier: Modifier = Modifier,
    centerLat: Double = 41.9028,
    centerLon: Double = 12.4964,
    zoom: Int = 14,
    userLocation: Pair<Double, Double>? = null,
    radiusMeters: Int? = null,
    stops: List<TransitStop> = emptyList(),
    selectedStop: TransitStop? = null,
    routeCoordinates: List<Pair<Double, Double>>? = null,
    onStopSelected: (TransitStop) -> Unit = {}
) {
    val stopsById = remember(stops) { stops.associateBy { it.id } }

    val bridge = remember(stopsById, onStopSelected) {
        AndroidMapBridge { stopId ->
            val found = stopsById[stopId] ?: stops.find { it.code == stopId }
            if (found != null) {
                onStopSelected(found)
            }
        }
    }

    // Build JSON data for the Leaflet view
    val stopsJson = remember(stops) {
        val arr = JSONArray()
        stops.take(150).forEach { s ->
            val obj = JSONObject()
            obj.put("id", s.id)
            obj.put("code", s.code)
            obj.put("name", s.name)
            obj.put("lat", s.lat)
            obj.put("lon", s.lon)
            arr.put(obj)
        }
        arr.toString()
    }

    val routeJson = remember(routeCoordinates) {
        val arr = JSONArray()
        routeCoordinates?.forEach { pt ->
            val ptArr = JSONArray()
            ptArr.put(pt.first)
            ptArr.put(pt.second)
            arr.put(ptArr)
        }
        arr.toString()
    }

    val selStopJson = remember(selectedStop) {
        if (selectedStop == null) "null" else {
            val obj = JSONObject()
            obj.put("id", selectedStop.id)
            obj.put("code", selectedStop.code)
            obj.put("name", selectedStop.name)
            obj.put("lat", selectedStop.lat)
            obj.put("lon", selectedStop.lon)
            obj.toString()
        }
    }

    val userLat = userLocation?.first ?: centerLat
    val userLon = userLocation?.second ?: centerLon
    val hasUserLoc = userLocation != null
    val radiusVal = radiusMeters ?: 0

    val htmlContent = remember(userLat, userLon, hasUserLoc, radiusVal, stopsJson, selStopJson, routeJson) {
        """
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8"/>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
            <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
            <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
            <style>
                html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #f0f0f0; }
                .bus-stop-pin { display: flex; flex-direction: column; align-items: center; cursor: pointer; }
                .stop-circle { width: 24px; height: 24px; border-radius: 50%; background: #8e1823; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; border: 2px solid #fff; box-shadow: 0 2px 5px rgba(0,0,0,0.35); }
                .stop-badge { background: rgba(20,20,20,0.9); color: #fff; font-size: 9px; font-weight: bold; padding: 1px 4px; border-radius: 3px; margin-top: 1px; white-space: nowrap; max-width: 75px; overflow: hidden; text-overflow: ellipsis; }
                .sel-stop-circle { background: #b71c1c; width: 30px; height: 30px; font-size: 14px; border: 3px solid #fff; box-shadow: 0 3px 8px rgba(0,0,0,0.45); }
                .user-pulse { width: 16px; height: 16px; border-radius: 50%; background: #1976d2; border: 2px solid #fff; box-shadow: 0 0 0 5px rgba(25, 118, 210, 0.4); }
                .leaflet-popup-content { margin: 8px 12px; font-family: sans-serif; font-size: 13px; }
            </style>
        </head>
        <body>
        <div id="map"></div>
        <script>
            var map = L.map('map', { zoomControl: false, attributionControl: false }).setView([$centerLat, $centerLon], $zoom);
            L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

            var stopsData = $stopsJson;
            var routeData = $routeJson;
            var selStop = $selStopJson;
            var hasUser = $hasUserLoc;
            var userLat = $userLat;
            var userLon = $userLon;
            var radius = $radiusVal;

            var stopsGroup = L.featureGroup();

            // 1. Draw Stops Pins
            stopsData.forEach(function(s) {
                var isSel = selStop && selStop.id === s.id;
                var iconHtml = '<div class="bus-stop-pin">' +
                    '<div class="stop-circle' + (isSel ? ' sel-stop-circle' : '') + '">🚏</div>' +
                    '<div class="stop-badge">' + (s.code || s.id) + '</div>' +
                    '</div>';

                var customIcon = L.divIcon({
                    className: '',
                    html: iconHtml,
                    iconSize: [30, 40],
                    iconAnchor: [15, 20]
                });

                var marker = L.marker([s.lat, s.lon], { icon: customIcon });
                marker.bindPopup(
                    '<div style="min-width: 140px;">' +
                    '<div style="font-size: 10px; color: #888; font-weight: bold;">PALINA ATAC</div>' +
                    '<div style="font-size: 14px; font-weight: bold; color: #8e1823; margin: 2px 0;">' + s.name + '</div>' +
                    '<div style="font-size: 12px; margin-bottom: 6px;">Codice: <b>' + (s.code || s.id) + '</b></div>' +
                    '<button style="width: 100%; padding: 5px; background: #8e1823; color: #fff; border: none; border-radius: 4px; font-weight: bold; font-size: 11px; cursor: pointer;" onclick="if(window.AndroidBridge) window.AndroidBridge.onStopClicked(\'' + s.id + '\')">Vedi Arrivi Live</button>' +
                    '</div>'
                );

                marker.on('click', function() {
                    marker.openPopup();
                });

                stopsGroup.addLayer(marker);
            });
            stopsGroup.addTo(map);

            // 2. Draw User Location & Radius Circle
            if (hasUser) {
                var userIcon = L.divIcon({
                    className: '',
                    html: '<div class="user-pulse"></div>',
                    iconSize: [16, 16],
                    iconAnchor: [8, 8]
                });
                L.marker([userLat, userLon], { icon: userIcon }).addTo(map).bindPopup('<b>La tua posizione GPS</b>');

                if (radius > 0) {
                    var circle = L.circle([userLat, userLon], {
                        radius: radius,
                        color: '#8e1823',
                        weight: 2,
                        dashArray: '5, 5',
                        fillColor: '#8e1823',
                        fillOpacity: 0.08
                    }).addTo(map);

                    // Auto-zoom fit to the radius boundary!
                    try {
                        map.fitBounds(circle.getBounds(), { padding: [20, 20], maxZoom: 17 });
                    } catch(e) {}
                }
            }

            // 3. Draw Selected Stop
            if (selStop && (!hasUser || radius === 0)) {
                map.setView([selStop.lat, selStop.lon], 16);
            }

            // 4. Draw Route Line (Only selected direction!)
            if (routeData && routeData.length > 0) {
                var poly = L.polyline(routeData, {
                    color: '#8e1823',
                    weight: 5,
                    opacity: 0.9,
                    lineJoin: 'round'
                }).addTo(map);
                try {
                    map.fitBounds(poly.getBounds(), { padding: [25, 25] });
                } catch(e) {}
            }
        </script>
        </body>
        </html>
        """.trimIndent()
    }

    AndroidView(
        modifier = modifier,
        factory = { ctx ->
            WebView(ctx).apply {
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                settings.loadWithOverviewMode = true
                settings.useWideViewPort = true
                webViewClient = WebViewClient()
                addJavascriptInterface(bridge, "AndroidBridge")
                loadDataWithBaseURL("https://tile.openstreetmap.org", htmlContent, "text/html", "UTF-8", null)
            }
        },
        update = { webView ->
            webView.loadDataWithBaseURL("https://tile.openstreetmap.org", htmlContent, "text/html", "UTF-8", null)
        }
    )
}
