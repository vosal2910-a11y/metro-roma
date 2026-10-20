package com.example.romatransitexpress.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

data class TransitStatus(
    val vehiclesCount: Int = 0,
    val alertsCount: Int = 0
)

data class TransitStop(
    val id: String,
    val code: String,
    val name: String,
    val lat: Double,
    val lon: Double,
    val desc: String = ""
)

data class TransitArrival(
    val routeId: String,
    val headsign: String,
    val minutes: Int,
    val vehicleId: String,
    val delaySeconds: Int?,
    val occupancyStatus: Int?,
    val vehicleLat: Double?,
    val vehicleLon: Double?
)

data class TransitVehicle(
    val id: String,
    val routeId: String,
    val label: String,
    val lat: Double,
    val lon: Double,
    val speed: Double,
    val bearing: Double
)

data class TransitRoute(
    val id: String,
    val shortName: String,
    val longName: String,
    val type: Int
)

data class RouteDetails(
    val route: TransitRoute,
    val directions: Map<Int, List<TransitStop>>,
    val directionNames: Map<Int, String>,
    val shapes: Map<Int, List<Pair<Double, Double>>>
)

data class TransitAlert(
    val id: String,
    val header: String,
    val description: String,
    val routeIds: List<String>
)

class DataRepository {
    // Cloud URL deployed on Render with fallback to local development
    private val baseUrls = listOf(
        "https://metro-roma.onrender.com",
        "http://10.0.2.2:3001",
        "http://10.0.2.2:3000",
        "http://localhost:3001",
        "http://localhost:3000"
    )

    private suspend fun fetchJson(path: String): String? = withContext(Dispatchers.IO) {
        for (baseUrl in baseUrls) {
            try {
                val fullUrl = "$baseUrl$path"
                val connection = (URL(fullUrl).openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    connectTimeout = 6000
                    readTimeout = 8000
                    setRequestProperty("Accept", "application/json")
                    setRequestProperty("User-Agent", "RomaTransitExpress-Android/2.0")
                }
                if (connection.responseCode in 200..299) {
                    val reader = BufferedReader(InputStreamReader(connection.inputStream))
                    val response = reader.readText()
                    reader.close()
                    connection.disconnect()
                    return@withContext response
                }
                connection.disconnect()
            } catch (_: Exception) {
                // Try next base URL
            }
        }
        null
    }

    suspend fun getStatus(): TransitStatus = withContext(Dispatchers.IO) {
        try {
            val jsonStr = fetchJson("/api/status") ?: return@withContext TransitStatus()
            val obj = JSONObject(jsonStr)
            val counts = obj.optJSONObject("counts")
            TransitStatus(
                vehiclesCount = counts?.optInt("vehicles", 0) ?: 0,
                alertsCount = counts?.optInt("alerts", 0) ?: 0
            )
        } catch (_: Exception) {
            TransitStatus()
        }
    }

    suspend fun getVehicles(): List<TransitVehicle> = withContext(Dispatchers.IO) {
        try {
            val jsonStr = fetchJson("/api/vehicles") ?: return@withContext emptyList()
            val obj = JSONObject(jsonStr)
            val arr = obj.optJSONArray("vehicles") ?: JSONArray()
            val list = mutableListOf<TransitVehicle>()
            for (i in 0 until arr.length()) {
                val v = arr.getJSONObject(i)
                list.add(
                    TransitVehicle(
                        id = v.optString("id", ""),
                        routeId = v.optString("routeId", ""),
                        label = v.optString("label", ""),
                        lat = v.optDouble("lat", 0.0),
                        lon = v.optDouble("lon", 0.0),
                        speed = v.optDouble("speed", 0.0),
                        bearing = v.optDouble("bearing", 0.0)
                    )
                )
            }
            list
        } catch (_: Exception) {
            emptyList()
        }
    }

    suspend fun searchStops(query: String): List<TransitStop> = withContext(Dispatchers.IO) {
        if (query.trim().length < 2) return@withContext emptyList()
        try {
            val encoded = URLEncoder.encode(query.trim(), "UTF-8")
            val jsonStr = fetchJson("/api/stops/search?q=$encoded") ?: return@withContext emptyList()
            val arr = JSONArray(jsonStr)
            val list = mutableListOf<TransitStop>()
            for (i in 0 until arr.length()) {
                val s = arr.getJSONObject(i)
                list.add(
                    TransitStop(
                        id = s.optString("stop_id", ""),
                        code = s.optString("stop_code", s.optString("stop_id", "")),
                        name = s.optString("stop_name", "Fermata"),
                        lat = s.optDouble("stop_lat", 0.0),
                        lon = s.optDouble("stop_lon", 0.0),
                        desc = s.optString("stop_desc", "")
                    )
                )
            }
            list
        } catch (_: Exception) {
            emptyList()
        }
    }

    suspend fun getArrivals(stopId: String): List<TransitArrival> = withContext(Dispatchers.IO) {
        try {
            val jsonStr = fetchJson("/api/arrivals/$stopId") ?: return@withContext emptyList()
            val obj = JSONObject(jsonStr)
            val arr = obj.optJSONArray("arrivals") ?: JSONArray()
            val list = mutableListOf<TransitArrival>()
            for (i in 0 until arr.length()) {
                val a = arr.getJSONObject(i)
                list.add(
                    TransitArrival(
                        routeId = a.optString("routeId", ""),
                        headsign = a.optString("headsign", "Destinazione"),
                        minutes = a.optInt("minutes", 0),
                        vehicleId = a.optString("vehicleId", ""),
                        delaySeconds = if (a.has("delaySeconds") && !a.isNull("delaySeconds")) a.getInt("delaySeconds") else null,
                        occupancyStatus = if (a.has("occupancyStatus") && !a.isNull("occupancyStatus")) a.getInt("occupancyStatus") else null,
                        vehicleLat = if (a.has("vehicleLat") && !a.isNull("vehicleLat")) a.getDouble("vehicleLat") else null,
                        vehicleLon = if (a.has("vehicleLon") && !a.isNull("vehicleLon")) a.getDouble("vehicleLon") else null
                    )
                )
            }
            list
        } catch (_: Exception) {
            emptyList()
        }
    }

    suspend fun getRoutes(): List<TransitRoute> = withContext(Dispatchers.IO) {
        try {
            val jsonStr = fetchJson("/api/routes") ?: return@withContext emptyList()
            val arr = JSONArray(jsonStr)
            val list = mutableListOf<TransitRoute>()
            for (i in 0 until arr.length()) {
                val r = arr.getJSONObject(i)
                list.add(
                    TransitRoute(
                        id = r.optString("route_id", ""),
                        shortName = r.optString("route_short_name", r.optString("route_id", "")),
                        longName = r.optString("route_long_name", ""),
                        type = r.optInt("route_type", 3)
                    )
                )
            }
            list
        } catch (_: Exception) {
            emptyList()
        }
    }

    suspend fun getNearbyStops(lat: Double, lon: Double, radius: Int): List<Pair<TransitStop, Int>> = withContext(Dispatchers.IO) {
        try {
            val jsonStr = fetchJson("/api/stops/nearby?lat=$lat&lon=$lon&radius=$radius") ?: return@withContext emptyList()
            val arr = JSONArray(jsonStr)
            val list = mutableListOf<Pair<TransitStop, Int>>()
            for (i in 0 until arr.length()) {
                val s = arr.getJSONObject(i)
                val stop = TransitStop(
                    id = s.optString("stop_id", ""),
                    code = s.optString("stop_code", s.optString("stop_id", "")),
                    name = s.optString("stop_name", "Fermata"),
                    lat = s.optDouble("stop_lat", 0.0),
                    lon = s.optDouble("stop_lon", 0.0),
                    desc = s.optString("stop_desc", "")
                )
                val dist = if (s.has("distance")) s.optInt("distance", 0) else s.optInt("distanceMeters", 0)
                list.add(Pair(stop, dist))
            }
            list
        } catch (_: Exception) {
            emptyList()
        }
    }

    suspend fun getStopsInBounds(minLat: Double, maxLat: Double, minLon: Double, maxLon: Double): List<TransitStop> = withContext(Dispatchers.IO) {
        try {
            val jsonStr = fetchJson("/api/stops/bounds?minLat=$minLat&maxLat=$maxLat&minLon=$minLon&maxLon=$maxLon&limit=120") ?: return@withContext emptyList()
            val arr = JSONArray(jsonStr)
            val list = mutableListOf<TransitStop>()
            for (i in 0 until arr.length()) {
                val s = arr.getJSONObject(i)
                list.add(
                    TransitStop(
                        id = s.optString("stop_id", ""),
                        code = s.optString("stop_code", s.optString("stop_id", "")),
                        name = s.optString("stop_name", "Fermata"),
                        lat = s.optDouble("stop_lat", 0.0),
                        lon = s.optDouble("stop_lon", 0.0),
                        desc = s.optString("stop_desc", "")
                    )
                )
            }
            list
        } catch (_: Exception) {
            emptyList()
        }
    }

    suspend fun getRouteDetails(routeId: String): RouteDetails? = withContext(Dispatchers.IO) {
        try {
            val stopsJson = fetchJson("/api/routes/$routeId/stops") ?: return@withContext null
            val stopsObj = JSONObject(stopsJson)
            val rObj = stopsObj.optJSONObject("route")
            val transitRoute = TransitRoute(
                id = rObj?.optString("route_id", routeId) ?: routeId,
                shortName = rObj?.optString("route_short_name", routeId) ?: routeId,
                longName = rObj?.optString("route_long_name", "") ?: "",
                type = rObj?.optInt("route_type", 3) ?: 3
            )

            val dirMap = mutableMapOf<Int, List<TransitStop>>()
            val dirsObj = stopsObj.optJSONObject("directions")
            if (dirsObj != null) {
                val keys = dirsObj.keys()
                while (keys.hasNext()) {
                    val k = keys.next()
                    val dirId = k.toIntOrNull() ?: 0
                    val arr = dirsObj.optJSONArray(k) ?: JSONArray()
                    val stopList = mutableListOf<TransitStop>()
                    for (i in 0 until arr.length()) {
                        val s = arr.getJSONObject(i)
                        stopList.add(
                            TransitStop(
                                id = s.optString("stop_id", ""),
                                code = s.optString("stop_code", s.optString("stop_id", "")),
                                name = s.optString("stop_name", "Fermata"),
                                lat = s.optDouble("stop_lat", 0.0),
                                lon = s.optDouble("stop_lon", 0.0)
                            )
                        )
                    }
                    dirMap[dirId] = stopList
                }
            }

            val dirNamesMap = mutableMapOf<Int, String>()
            val namesObj = stopsObj.optJSONObject("direction_names")
            if (namesObj != null) {
                val keys = namesObj.keys()
                while (keys.hasNext()) {
                    val k = keys.next()
                    val dirId = k.toIntOrNull() ?: 0
                    dirNamesMap[dirId] = namesObj.optString(k, "")
                }
            }

            // Fetch shapes for all directions
            val shapeJson = fetchJson("/api/routes/$routeId/shape")
            val shapesMap = mutableMapOf<Int, List<Pair<Double, Double>>>()
            if (shapeJson != null) {
                val sObj = JSONObject(shapeJson)
                val sArr = sObj.optJSONArray("shapes") ?: JSONArray()
                for (i in 0 until sArr.length()) {
                    val shapeItem = sArr.getJSONObject(i)
                    val dId = shapeItem.optInt("directionId", 0)
                    val coordsArr = shapeItem.optJSONArray("coordinates") ?: JSONArray()
                    val pts = mutableListOf<Pair<Double, Double>>()
                    for (j in 0 until coordsArr.length()) {
                        val pt = coordsArr.getJSONArray(j)
                        pts.add(Pair(pt.getDouble(0), pt.getDouble(1)))
                    }
                    if (pts.isNotEmpty()) {
                        shapesMap[dId] = pts
                    }
                }
            }

            RouteDetails(
                route = transitRoute,
                directions = dirMap,
                directionNames = dirNamesMap,
                shapes = shapesMap
            )
        } catch (_: Exception) {
            null
        }
    }

    suspend fun getAlerts(): List<TransitAlert> = withContext(Dispatchers.IO) {
        try {
            val jsonStr = fetchJson("/api/alerts") ?: return@withContext emptyList()
            val obj = JSONObject(jsonStr)
            val arr = obj.optJSONArray("alerts") ?: JSONArray()
            val list = mutableListOf<TransitAlert>()
            for (i in 0 until arr.length()) {
                val a = arr.getJSONObject(i)
                val informed = a.optJSONArray("informedEntities") ?: JSONArray()
                val routes = mutableListOf<String>()
                for (j in 0 until informed.length()) {
                    val entity = informed.getJSONObject(j)
                    val rId = entity.optString("routeId", "")
                    if (rId.isNotBlank()) routes.add(rId)
                }
                list.add(
                    TransitAlert(
                        id = a.optString("id", i.toString()),
                        header = a.optString("header", "Avviso di servizio"),
                        description = a.optString("description", ""),
                        routeIds = routes
                    )
                )
            }
            list
        } catch (_: Exception) {
            emptyList()
        }
    }
}
