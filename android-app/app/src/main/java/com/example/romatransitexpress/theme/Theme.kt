package com.example.romatransitexpress.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext

private val DarkColorScheme = darkColorScheme(
    primary = RomanRedPrimaryContainer,
    onPrimary = RomanRedOnPrimaryContainer,
    primaryContainer = RomanRedPrimary,
    onPrimaryContainer = RomanRedOnPrimary,
    secondary = TevereNavySecondaryContainer,
    onSecondary = TevereNavyOnSecondaryContainer,
    secondaryContainer = TevereNavySecondary,
    onSecondaryContainer = TevereNavyOnSecondary,
    tertiary = GoldTertiaryContainer,
    onTertiary = GoldOnTertiaryContainer,
    tertiaryContainer = GoldTertiary,
    onTertiaryContainer = GoldOnTertiary,
    background = SurfaceDark,
    onBackground = OnSurfaceDark,
    surface = SurfaceContainerDark,
    onSurface = OnSurfaceDark,
    surfaceVariant = SurfaceContainerHighDark,
    onSurfaceVariant = OnSurfaceVariantDark
)

private val LightColorScheme = lightColorScheme(
    primary = RomanRedPrimary,
    onPrimary = RomanRedOnPrimary,
    primaryContainer = RomanRedPrimaryContainer,
    onPrimaryContainer = RomanRedOnPrimaryContainer,
    secondary = TevereNavySecondary,
    onSecondary = TevereNavyOnSecondary,
    secondaryContainer = TevereNavySecondaryContainer,
    onSecondaryContainer = TevereNavyOnSecondaryContainer,
    tertiary = GoldTertiary,
    onTertiary = GoldOnTertiary,
    tertiaryContainer = GoldTertiaryContainer,
    onTertiaryContainer = GoldOnTertiaryContainer,
    background = SurfaceLight,
    onBackground = OnSurfaceLight,
    surface = SurfaceContainerLight,
    onSurface = OnSurfaceLight,
    surfaceVariant = SurfaceContainerHighLight,
    onSurfaceVariant = OnSurfaceVariantLight
)

@Composable
fun RomaTransitExpressTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = false, // Preserve branded Roman Transit Express styling
    content: @Composable () -> Unit,
) {
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }
        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
