package com.example.romatransitexpress.ui.main

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.LocationManager
import android.widget.Toast
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.romatransitexpress.data.*
import com.example.romatransitexpress.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(
    viewModel: MainScreenViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current
    var backPressedTime by remember { mutableLongStateOf(0L) }

    // Android System Back Gesture Handler
    BackHandler {
        if (uiState.selectedStop != null) {
            viewModel.clearSelectedStop()
        } else if (uiState.currentTab != TransitTab.ARRIVALS) {
            viewModel.selectTab(TransitTab.ARRIVALS)
        } else {
            val now = System.currentTimeMillis()
            if (now - backPressedTime < 2000) {
                (context as? android.app.Activity)?.finish()
            } else {
                backPressedTime = now
                Toast.makeText(context, "Premi di nuovo per uscire dall'app", Toast.LENGTH_SHORT).show()
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(36.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Text("R", color = Color.White, fontWeight = FontWeight.Black, fontSize = 18.sp)
                            }
                        }
                        Column {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text(
                                    "Roma Transit by Fox",
                                    fontWeight = FontWeight.ExtraBold,
                                    fontSize = 17.sp,
                                    maxLines = 1
                                )
                                Surface(
                                    shape = CircleShape,
                                    color = Color(0xFF2E7D32),
                                    modifier = Modifier.padding(top = 1.dp)
                                ) {
                                    Text(
                                        "LIVE",
                                        color = Color.White,
                                        fontSize = 9.sp,
                                        fontWeight = FontWeight.Bold,
                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                    )
                                }
                            }
                            Text(
                                "GTFS-RT Ufficiale Roma Mobilità",
                                fontSize = 11.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                },
                actions = {
                    if (uiState.status.vehiclesCount > 0) {
                        Surface(
                            shape = CircleShape,
                            color = MaterialTheme.colorScheme.surfaceVariant,
                            modifier = Modifier.padding(end = 4.dp)
                        ) {
                            Text(
                                "🚌 ${uiState.status.vehiclesCount}",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                            )
                        }
                    }
                    IconButton(onClick = { viewModel.refreshGlobal() }) {
                        Text("🔄", fontSize = 18.sp)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        },
        bottomBar = {
            NavigationBar(
                containerColor = MaterialTheme.colorScheme.surface,
                tonalElevation = 8.dp
            ) {
                TransitTab.values().forEach { tab ->
                    val selected = uiState.currentTab == tab
                    NavigationBarItem(
                        selected = selected,
                        onClick = { viewModel.selectTab(tab) },
                        icon = {
                            Text(tab.iconEmoji, fontSize = if (selected) 20.sp else 18.sp)
                        },
                        label = {
                            Text(
                                tab.label,
                                fontSize = 11.sp,
                                fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium
                            )
                        },
                        colors = NavigationBarItemDefaults.colors(
                            indicatorColor = MaterialTheme.colorScheme.primaryContainer
                        )
                    )
                }
            }
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            when (uiState.currentTab) {
                TransitTab.ARRIVALS -> ArrivalsScreen(viewModel, uiState)
                TransitTab.RADAR -> RadarScreen(viewModel, uiState)
                TransitTab.ROUTES -> RoutesScreen(viewModel, uiState)
                TransitTab.NEARBY -> NearbyScreen(viewModel, uiState)
                TransitTab.ALERTS -> AlertsScreen(viewModel, uiState)
            }
        }
    }
}

// =========================================================================
// 1. ARRIVALS SCREEN
// =========================================================================
@Composable
fun ArrivalsScreen(viewModel: MainScreenViewModel, state: MainUiState) {
    val focusManager = LocalFocusManager.current
    val quickStops = listOf(
        "Termini", "Colosseo", "P.za Venezia", "Ponte Mammolo",
        "Tiburtina", "Cinecittà", "P.za Mancini"
    )

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(bottom = 24.dp)
    ) {
        // Search Header
        item {
            Column(modifier = Modifier.padding(16.dp)) {
                OutlinedTextField(
                    value = state.searchQuery,
                    onValueChange = { viewModel.onSearchQueryChanged(it) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(28.dp),
                    placeholder = { Text("Cerca palina (es. 70046, 79644) o via...") },
                    leadingIcon = { Text("🔍", fontSize = 16.sp) },
                    trailingIcon = {
                        if (state.searchQuery.isNotEmpty()) {
                            IconButton(onClick = { viewModel.onSearchQueryChanged("") }) {
                                Text("✕", fontSize = 15.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                    keyboardActions = KeyboardActions(onSearch = { focusManager.clearFocus() })
                )

                // Quick Hub Chips
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 10.dp)
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    quickStops.forEach { hub ->
                        SuggestionChip(
                            onClick = {
                                viewModel.onSearchQueryChanged(hub)
                            },
                            label = { Text("📍 $hub", fontSize = 11.sp, fontWeight = FontWeight.Bold) },
                            shape = CircleShape
                        )
                    }
                }
            }
        }

        // Search Results List
        if (state.searchResults.isNotEmpty()) {
            item {
                Text(
                    "Risultati fermate (${state.searchResults.size})",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
                )
            }
            items(state.searchResults) { stop ->
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 4.dp)
                        .clickable { viewModel.selectStop(stop) },
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.padding(end = 12.dp)
                        ) {
                            Text(
                                stop.code,
                                color = Color.White,
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                            )
                        }
                        Column(modifier = Modifier.weight(1f)) {
                            Text(stop.name, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                            if (stop.desc.isNotBlank()) {
                                Text(stop.desc, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    }
                }
            }
        }

        // Selected Stop Details Card
        state.selectedStop?.let { stop ->
            item {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.Top
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text("PALINA ${stop.code}", fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = MaterialTheme.colorScheme.primary)
                                Text(stop.name, fontSize = 18.sp, fontWeight = FontWeight.Black)
                                Text("Lat: ${stop.lat}, Lon: ${stop.lon}", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            IconButton(onClick = { viewModel.refreshArrivals() }) {
                                Text("🔄", fontSize = 18.sp)
                            }
                        }
                    }
                }
            }

            // Real-time Arrivals List
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        "PROSSIMI PASSAGGI LIVE (${state.arrivals.size})",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    if (state.isLoadingArrivals) {
                        CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                    }
                }
            }

            if (state.arrivals.isEmpty() && !state.isLoadingArrivals) {
                item {
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        shape = RoundedCornerShape(16.dp)
                    ) {
                        Text(
                            "Nessun passaggio attivo nei prossimi 60-90 minuti per questa fermata.",
                            modifier = Modifier.padding(20.dp),
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                            fontSize = 13.sp
                        )
                    }
                }
            } else {
                items(state.arrivals) { arr ->
                    ArrivalCard(arr)
                }
            }
        } ?: run {
            if (state.searchResults.isEmpty()) {
                item {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 40.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text("🚏", fontSize = 48.sp)
                        Spacer(modifier = Modifier.height(12.dp))
                        Text("Cerca una palina o tocca una stazione", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        Text("Visualizza gli arrivi dei bus e tram in tempo reale", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
    }
}

@Composable
fun ArrivalCard(arr: TransitArrival) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Line Badge
            Surface(
                shape = RoundedCornerShape(12.dp),
                color = when (arr.routeId.uppercase()) {
                    "MEA", "MA" -> MetroAColor
                    "MEB", "MEB1", "MB" -> MetroBColor
                    "MEC", "MC" -> MetroCColor
                    "2", "3", "5", "8", "14", "19" -> TramColor
                    else -> MaterialTheme.colorScheme.primary
                },
                modifier = Modifier.size(46.dp)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Text(
                        arr.routeId,
                        color = Color.White,
                        fontWeight = FontWeight.Black,
                        fontSize = 15.sp,
                        maxLines = 1
                    )
                }
            }

            Spacer(modifier = Modifier.width(12.dp))

            // Line Info
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    arr.headsign,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(top = 2.dp)
                ) {
                    if (arr.vehicleId.isNotBlank()) {
                        Text(
                            "#${arr.vehicleId}",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    arr.delaySeconds?.let { sec ->
                        val mins = sec / 60
                        val delayText = when {
                            mins > 0 -> "+$mins min"
                            mins < 0 -> "${mins} min"
                            else -> "In orario"
                        }
                        val delayColor = when {
                            mins > 0 -> DelayLateColor
                            mins < 0 -> DelayEarlyColor
                            else -> DelayOnTimeColor
                        }
                        Surface(
                            shape = CircleShape,
                            color = delayColor.copy(alpha = 0.15f)
                        ) {
                            Text(
                                delayText,
                                color = delayColor,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 1.dp)
                            )
                        }
                    }
                }
            }

            // Minutes Badge
            Surface(
                shape = RoundedCornerShape(14.dp),
                color = if (arr.minutes <= 2) Color(0xFFC62828) else MaterialTheme.colorScheme.secondaryContainer,
                modifier = Modifier.padding(start = 8.dp)
            ) {
                Text(
                    if (arr.minutes == 0) "In arrivo" else "${arr.minutes} min",
                    color = if (arr.minutes <= 2) Color.White else MaterialTheme.colorScheme.onSecondaryContainer,
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = 12.sp,
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                )
            }
        }
    }
}

// =========================================================================
// 2. RADAR SCREEN
// =========================================================================
@Composable
fun RadarScreen(viewModel: MainScreenViewModel, state: MainUiState) {
    val filtered = state.vehicles.filter { v ->
        val q = state.vehicleFilter.trim().uppercase()
        val matchQuery = q.isEmpty() || v.routeId.uppercase().contains(q) || v.label.uppercase().contains(q)
        val matchType = when (state.vehicleTypeFilter) {
            "TRAM" -> listOf("2", "3", "5", "8", "14", "19").contains(v.routeId)
            "METRO" -> listOf("MEA", "MEB", "MEB1", "MEC", "MA", "MB", "MC").contains(v.routeId)
            "BUS" -> !listOf("2", "3", "5", "8", "14", "19", "MEA", "MEB", "MEB1", "MEC", "MA", "MB", "MC").contains(v.routeId)
            else -> true
        }
        matchQuery && matchType
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(bottom = 24.dp)
    ) {
        item {
            Column(modifier = Modifier.padding(16.dp)) {
                OutlinedTextField(
                    value = state.vehicleFilter,
                    onValueChange = { viewModel.setVehicleFilter(it) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(28.dp),
                    placeholder = { Text("Filtra per linea (es. 64, 451) o matricola...") },
                    leadingIcon = { Text("🔍", fontSize = 16.sp) },
                    singleLine = true
                )

                // Type Filter Chips
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 10.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    listOf("ALL" to "Tutti", "BUS" to "Bus", "TRAM" to "Tram", "METRO" to "Metro").forEach { (key, label) ->
                        val selected = state.vehicleTypeFilter == key
                        FilterChip(
                            selected = selected,
                            onClick = { viewModel.setVehicleTypeFilter(key) },
                            label = { Text(label, fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal) },
                            shape = CircleShape
                        )
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    "${filtered.size} veicoli in servizio attivo",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        items(filtered) { v ->
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 4.dp),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Surface(
                        shape = RoundedCornerShape(10.dp),
                        color = MaterialTheme.colorScheme.secondary,
                        modifier = Modifier.size(40.dp)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Text(v.routeId, color = Color.White, fontWeight = FontWeight.Black, fontSize = 13.sp)
                        }
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Linea ${v.routeId} • Matr. #${v.label}", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        Text("Pos: ${String.format("%.4f", v.lat)}, ${String.format("%.4f", v.lon)}", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    if (v.speed > 0) {
                        Surface(shape = CircleShape, color = MaterialTheme.colorScheme.surfaceVariant) {
                            Text(
                                "${v.speed.toInt()} km/h",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}

// =========================================================================
// 3. ROUTES SCREEN
// =========================================================================
@Composable
fun RoutesScreen(viewModel: MainScreenViewModel, state: MainUiState) {
    val filtered = state.routes.filter { r ->
        val q = state.routeSearchQuery.trim().uppercase()
        val matchQ = q.isEmpty() || r.shortName.uppercase().contains(q) || r.longName.uppercase().contains(q)
        val matchType = when (state.routeTypeFilter) {
            "METRO" -> r.type == 1 || listOf("MEA", "MEB", "MEB1", "MEC", "MA", "MB", "MC").contains(r.shortName.uppercase())
            "TRAM" -> r.type == 0 || listOf("2", "3", "5", "8", "14", "19").contains(r.shortName)
            "BUS" -> r.type == 3 && !listOf("MEA", "MEB", "MEC", "2", "3", "5", "8", "14", "19").contains(r.shortName)
            else -> true
        }
        matchQ && matchType
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(bottom = 24.dp)
    ) {
        item {
            Column(modifier = Modifier.padding(16.dp)) {
                OutlinedTextField(
                    value = state.routeSearchQuery,
                    onValueChange = { viewModel.setRouteSearchQuery(it) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(28.dp),
                    placeholder = { Text("Cerca linea (es. MEA, 64, 8, 451)...") },
                    leadingIcon = { Text("🔍", fontSize = 16.sp) },
                    singleLine = true
                )

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 10.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    listOf("ALL" to "Tutte", "METRO" to "Metro", "TRAM" to "Tram", "BUS" to "Bus").forEach { (key, label) ->
                        val selected = state.routeTypeFilter == key
                        FilterChip(
                            selected = selected,
                            onClick = { viewModel.setRouteTypeFilter(key) },
                            label = { Text(label, fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal) },
                            shape = CircleShape
                        )
                    }
                }
            }
        }

        items(filtered) { r ->
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 4.dp),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
            ) {
                Row(
                    modifier = Modifier.padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = when (r.shortName.uppercase()) {
                            "MEA", "MA" -> MetroAColor
                            "MEB", "MEB1", "MB" -> MetroBColor
                            "MEC", "MC" -> MetroCColor
                            "2", "3", "5", "8", "14", "19" -> TramColor
                            else -> MaterialTheme.colorScheme.primary
                        },
                        modifier = Modifier.size(44.dp)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Text(r.shortName, color = Color.White, fontWeight = FontWeight.Black, fontSize = 14.sp)
                        }
                    }
                    Spacer(modifier = Modifier.width(14.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Linea ${r.shortName}", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                        if (r.longName.isNotBlank()) {
                            Text(r.longName, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                    }
                }
            }
        }
    }
}

// =========================================================================
// 4. NEARBY SCREEN
// =========================================================================
@Composable
fun NearbyScreen(viewModel: MainScreenViewModel, state: MainUiState) {
    val context = LocalContext.current
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { perms ->
        val granted = perms[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
                perms[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        if (granted) {
            val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
            val loc = locationManager?.getLastKnownLocation(LocationManager.GPS_PROVIDER)
                ?: locationManager?.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
            loc?.let {
                viewModel.updateLocation(it.latitude, it.longitude)
                Toast.makeText(context, "Posizione GPS aggiornata!", Toast.LENGTH_SHORT).show()
            } ?: run {
                Toast.makeText(context, "Ricerca segnale GPS...", Toast.LENGTH_SHORT).show()
            }
        } else {
            Toast.makeText(context, "Permesso GPS negato", Toast.LENGTH_SHORT).show()
        }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(bottom = 24.dp)
    ) {
        item {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text("📍 Fermate nei Dintorni", fontWeight = FontWeight.Bold, fontSize = 17.sp)
                            Text(
                                if (state.isGpsActive) "Posizione GPS attiva" else "Posizione di default: Termini",
                                fontSize = 12.sp,
                                color = MaterialTheme.colorScheme.onSecondaryContainer
                            )
                        }
                        Button(
                            onClick = {
                                permissionLauncher.launch(
                                    arrayOf(
                                        Manifest.permission.ACCESS_FINE_LOCATION,
                                        Manifest.permission.ACCESS_COARSE_LOCATION
                                    )
                                )
                            },
                            shape = CircleShape
                        ) {
                            Text("Rileva GPS", fontSize = 12.sp)
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    // Radius selector chips
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf(300, 500, 800, 1200).forEach { rad ->
                            val selected = state.nearbyRadius == rad
                            FilterChip(
                                selected = selected,
                                onClick = { viewModel.setNearbyRadius(rad) },
                                label = { Text("${rad}m", fontSize = 11.sp) },
                                shape = CircleShape
                            )
                        }
                    }
                }
            }
        }

        items(state.nearbyStops) { (stop, dist) ->
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 4.dp)
                    .clickable { viewModel.selectStop(stop) },
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
            ) {
                Row(
                    modifier = Modifier.padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Surface(
                        shape = RoundedCornerShape(10.dp),
                        color = MaterialTheme.colorScheme.tertiary,
                        modifier = Modifier.size(40.dp)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Text(stop.code, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 11.sp)
                        }
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(stop.name, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        Text("${dist}m da te", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.primary)
                    }
                    Text("➡️", fontSize = 16.sp)
                }
            }
        }
    }
}

// =========================================================================
// 5. ALERTS SCREEN
// =========================================================================
@Composable
fun AlertsScreen(viewModel: MainScreenViewModel, state: MainUiState) {
    val filtered = state.alerts.filter { a ->
        val q = state.alertsQuery.trim().uppercase()
        q.isEmpty() || a.header.uppercase().contains(q) || a.description.uppercase().contains(q) || a.routeIds.any { it.uppercase().contains(q) }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(bottom = 24.dp)
    ) {
        item {
            Column(modifier = Modifier.padding(16.dp)) {
                OutlinedTextField(
                    value = state.alertsQuery,
                    onValueChange = { viewModel.setAlertsQuery(it) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(28.dp),
                    placeholder = { Text("Cerca avviso o linea (es. 89, deviazione)...") },
                    leadingIcon = { Text("🔍", fontSize = 16.sp) },
                    singleLine = true
                )
                Spacer(modifier = Modifier.height(10.dp))
                Text(
                    "Avvisi ufficiali attivi (${filtered.size})",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        items(filtered) { alert ->
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 6.dp),
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Surface(
                            shape = CircleShape,
                            color = Color(0xFFC62828)
                        ) {
                            Text(
                                "⚠️ ATAC",
                                color = Color.White,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                            )
                        }
                        if (alert.routeIds.isNotEmpty()) {
                            alert.routeIds.take(5).forEach { rId ->
                                Surface(
                                    shape = CircleShape,
                                    color = MaterialTheme.colorScheme.primaryContainer
                                ) {
                                    Text(
                                        rId,
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                    )
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))
                    Text(alert.header, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                    if (alert.description.isNotBlank()) {
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            alert.description,
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }
    }
}
