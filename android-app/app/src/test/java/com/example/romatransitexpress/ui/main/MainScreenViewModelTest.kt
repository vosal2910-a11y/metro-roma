package com.example.romatransitexpress.ui.main

import junit.framework.TestCase.assertEquals
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.Test

class MainScreenViewModelTest {
  @Test
  fun initialTab_isArrivals() = runTest {
    val viewModel = MainScreenViewModel()
    assertEquals(TransitTab.ARRIVALS, viewModel.uiState.first().currentTab)
  }

  @Test
  fun selectTab_updatesCurrentTab() = runTest {
    val viewModel = MainScreenViewModel()
    viewModel.selectTab(TransitTab.RADAR)
    assertEquals(TransitTab.RADAR, viewModel.uiState.first().currentTab)
  }
}
