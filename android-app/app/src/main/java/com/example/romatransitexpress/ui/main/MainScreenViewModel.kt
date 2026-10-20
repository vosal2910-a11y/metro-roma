package com.example.romatransitexpress.ui.main

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.romatransitexpress.data.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

enum class TransitTab(val label: String, val iconEmoji: String) {
    ARRIVALS("Palina", "🚏"),
    RADAR("Radar GPS", "📡"),
    ROUTES("Linee", "🛣️"),
    NEARBY("Vicine", "📍"),
    ALERTS("Avvisi", "⚠️")
}

data class MainUiState(
    val currentTab: TransitTab = TransitTab.ARRIVALS,
    val status: TransitStatus = TransitStatus(),
    val isRefreshing: Boolean = false,
    // Arrivals Tab
    val searchQuery: String = "",
    val searchResults: List<TransitStop> = emptyList(),
    val isSearching: Boolean = false,
    val selectedStop: TransitStop? = null,
    val arrivals: List<TransitArrival> = emptyList(),
    val isLoadingArrivals: Boolean = false,
    val mainMapStops: List<TransitStop> = emptyList(),
    // Radar Tab
    val vehicles: List<TransitVehicle> = emptyList(),
    val vehicleFilter: String = "",
    val vehicleTypeFilter: String = "ALL", // ALL, BUS, TRAM, METRO
    // Routes Tab
    val routes: List<TransitRoute> = emptyList(),
    val routeTypeFilter: String = "ALL",
    val routeSearchQuery: String = "",
    val selectedRouteDetails: RouteDetails? = null,
    val selectedRouteDirection: Int = 0,
    val isLoadingRouteDetails: Boolean = false,
    // Nearby Tab
    val userLat: Double = 41.9010,
    val userLon: Double = 12.5002,
    val isGpsActive: Boolean = false,
    val nearbyRadius: Int = 650,
    val nearbyStops: List<Pair<TransitStop, Int>> = emptyList(),
    val isLoadingNearby: Boolean = false,
    // Alerts Tab
    val alerts: List<TransitAlert> = emptyList(),
    val alertsQuery: String = ""
)

class MainScreenViewModel(
    private val repository: DataRepository = DataRepository()
) : ViewModel() {

    private val _uiState = MutableStateFlow(MainUiState())
    val uiState: StateFlow<MainUiState> = _uiState.asStateFlow()

    init {
        refreshGlobal()
        loadRoutes()
        loadAlerts()
        loadNearby()
        loadMainMapStops()
    }

    fun selectTab(tab: TransitTab) {
        _uiState.value = _uiState.value.copy(currentTab = tab)
        if (tab == TransitTab.RADAR && _uiState.value.vehicles.isEmpty()) {
            refreshVehicles()
        } else if (tab == TransitTab.ALERTS && _uiState.value.alerts.isEmpty()) {
            loadAlerts()
        }
    }

    fun refreshGlobal() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isRefreshing = true)
            val status = repository.getStatus()
            val vehicles = repository.getVehicles()
            _uiState.value = _uiState.value.copy(
                status = status,
                vehicles = vehicles,
                isRefreshing = false
            )
        }
    }

    fun refreshVehicles() {
        viewModelScope.launch {
            val vehicles = repository.getVehicles()
            _uiState.value = _uiState.value.copy(vehicles = vehicles)
        }
    }

    fun onSearchQueryChanged(q: String) {
        _uiState.value = _uiState.value.copy(searchQuery = q)
        if (q.trim().length >= 2) {
            viewModelScope.launch {
                _uiState.value = _uiState.value.copy(isSearching = true)
                val results = repository.searchStops(q)
                _uiState.value = _uiState.value.copy(searchResults = results, isSearching = false)
            }
        } else {
            _uiState.value = _uiState.value.copy(searchResults = emptyList())
        }
    }

    fun selectStop(stop: TransitStop) {
        _uiState.value = _uiState.value.copy(
            selectedStop = stop,
            searchResults = emptyList(),
            currentTab = TransitTab.ARRIVALS,
            isLoadingArrivals = true
        )
        viewModelScope.launch {
            val arrivals = repository.getArrivals(stop.id)
            _uiState.value = _uiState.value.copy(
                arrivals = arrivals,
                isLoadingArrivals = false
            )
        }
    }

    fun clearSelectedStop() {
        _uiState.value = _uiState.value.copy(selectedStop = null, arrivals = emptyList())
    }

    fun refreshArrivals() {
        val stop = _uiState.value.selectedStop ?: return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoadingArrivals = true)
            val arrivals = repository.getArrivals(stop.id)
            _uiState.value = _uiState.value.copy(arrivals = arrivals, isLoadingArrivals = false)
        }
    }

    fun setVehicleFilter(filter: String) {
        _uiState.value = _uiState.value.copy(vehicleFilter = filter)
    }

    fun setVehicleTypeFilter(type: String) {
        _uiState.value = _uiState.value.copy(vehicleTypeFilter = type)
    }

    fun loadRoutes() {
        viewModelScope.launch {
            val routes = repository.getRoutes()
            _uiState.value = _uiState.value.copy(routes = routes)
        }
    }

    fun setRouteTypeFilter(type: String) {
        _uiState.value = _uiState.value.copy(routeTypeFilter = type)
    }

    fun setRouteSearchQuery(q: String) {
        _uiState.value = _uiState.value.copy(routeSearchQuery = q)
    }

    fun updateLocation(lat: Double, lon: Double) {
        _uiState.value = _uiState.value.copy(userLat = lat, userLon = lon, isGpsActive = true)
        loadNearby()
    }

    fun setNearbyRadius(radius: Int) {
        _uiState.value = _uiState.value.copy(nearbyRadius = radius)
        loadNearby()
    }

    fun loadNearby() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoadingNearby = true)
            val lat = _uiState.value.userLat
            val lon = _uiState.value.userLon
            val rad = _uiState.value.nearbyRadius
            val stops = repository.getNearbyStops(lat, lon, rad)
            _uiState.value = _uiState.value.copy(nearbyStops = stops, isLoadingNearby = false)
        }
    }

    fun loadAlerts() {
        viewModelScope.launch {
            val alerts = repository.getAlerts()
            _uiState.value = _uiState.value.copy(alerts = alerts)
        }
    }

    fun loadMainMapStops() {
        viewModelScope.launch {
            val stops = repository.getStopsInBounds(41.885, 41.915, 12.470, 12.520)
            if (stops.isNotEmpty()) {
                _uiState.value = _uiState.value.copy(mainMapStops = stops)
            } else {
                val nearby = repository.getNearbyStops(_uiState.value.userLat, _uiState.value.userLon, 800)
                _uiState.value = _uiState.value.copy(mainMapStops = nearby.map { it.first })
            }
        }
    }

    fun selectRoute(route: TransitRoute) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoadingRouteDetails = true)
            val details = repository.getRouteDetails(route.id)
            val defaultDir = details?.directions?.keys?.firstOrNull() ?: 0
            _uiState.value = _uiState.value.copy(
                selectedRouteDetails = details,
                selectedRouteDirection = defaultDir,
                isLoadingRouteDetails = false
            )
        }
    }

    fun selectRouteDirection(dir: Int) {
        _uiState.value = _uiState.value.copy(selectedRouteDirection = dir)
    }

    fun clearSelectedRoute() {
        _uiState.value = _uiState.value.copy(selectedRouteDetails = null)
    }

    fun setAlertsQuery(q: String) {
        _uiState.value = _uiState.value.copy(alertsQuery = q)
    }
}
