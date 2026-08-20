package com.ntvelop.mprikiwinners.ui.navigation

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Leaderboard
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.ntvelop.mprikiwinners.ui.auth.AuthScreen
import com.ntvelop.mprikiwinners.ui.auth.AuthUiState
import com.ntvelop.mprikiwinners.ui.auth.AuthViewModel
import com.ntvelop.mprikiwinners.ui.leaderboard.LeaderboardScreen
import com.ntvelop.mprikiwinners.ui.leaderboard.LeaderboardViewModel
import com.ntvelop.mprikiwinners.ui.profile.MonthlyDrawProfileScreen
import com.ntvelop.mprikiwinners.ui.profile.ProfileViewModel
import com.ntvelop.mprikiwinners.ui.scanner.ScannerScreen
import com.ntvelop.mprikiwinners.ui.scanner.ScannerViewModel

sealed class Screen(val route: String, val title: String, val icon: ImageVector) {
    data object Scanner : Screen("scanner", "Σκανάρισμα", Icons.Default.QrCodeScanner)
    data object Leaderboard : Screen("leaderboard", "Νικητές", Icons.Default.Leaderboard)
    data object Profile : Screen("profile", "Προφίλ", Icons.Default.Person)
}

@Composable
fun AppNavigation(
    authViewModel: AuthViewModel = viewModel()
) {
    val navController = rememberNavController()
    val authState by authViewModel.uiState.collectAsState()

    val navItems = listOf(
        Screen.Scanner,
        Screen.Leaderboard,
        Screen.Profile
    )

    if (authState !is AuthUiState.Success) {
        AuthScreen(
            viewModel = authViewModel,
            onAuthSuccess = {
                // NavHost will render main screens when user state changes
            }
        )
    } else {
        val navBackStackEntry by navController.currentBackStackEntryAsState()
        val currentRoute = navBackStackEntry?.destination?.route

        Scaffold(
            bottomBar = {
                NavigationBar(
                    containerColor = MaterialTheme.colorScheme.surfaceContainerHigh,
                    tonalElevation = 8.dp
                ) {
                    navItems.forEach { screen ->
                        NavigationBarItem(
                            selected = currentRoute == screen.route,
                            onClick = {
                                navController.navigate(screen.route) {
                                    popUpTo(navController.graph.findStartDestination().id) {
                                        saveState = true
                                    }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            icon = { Icon(screen.icon, contentDescription = screen.title) },
                            label = { Text(screen.title, fontWeight = FontWeight.SemiBold) }
                        )
                    }
                }
            }
        ) { innerPadding ->
            NavHost(
                navController = navController,
                startDestination = Screen.Scanner.route,
                modifier = Modifier.padding(innerPadding)
            ) {
                composable(Screen.Scanner.route) {
                    val scannerViewModel: ScannerViewModel = viewModel()
                    CameraPermissionWrapper {
                        ScannerScreen(viewModel = scannerViewModel)
                    }
                }

                composable(Screen.Leaderboard.route) {
                    val leaderboardViewModel: LeaderboardViewModel = viewModel()
                    LeaderboardScreen(viewModel = leaderboardViewModel)
                }

                composable(Screen.Profile.route) {
                    val profileViewModel: ProfileViewModel = viewModel()
                    MonthlyDrawProfileScreen(
                        viewModel = profileViewModel,
                        onSignOut = {
                            authViewModel.signOut()
                        }
                    )
                }
            }
        }
    }
}

@Composable
fun CameraPermissionWrapper(
    content: @Composable () -> Unit
) {
    val context = LocalContext.current
    var hasCameraPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.CAMERA
            ) == PackageManager.PERMISSION_GRANTED
        )
    }

    val launcher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission(),
        onResult = { isGranted ->
            hasCameraPermission = isGranted
        }
    )

    if (hasCameraPermission) {
        content()
    } else {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.surface)
                .padding(24.dp),
            contentAlignment = Alignment.Center
        ) {
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerHigh),
                shape = RoundedCornerShape(20.dp),
                elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.CameraAlt,
                        contentDescription = "Άδεια Κάμερας",
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(64.dp)
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = "Απαιτείται Άδεια Κάμερας",
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                        textAlign = TextAlign.Center
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Για να σκανάρετε QR codes για δώρα και συμμετοχές, παρακαλώ δώστε πρόσβαση στην κάμερα.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center
                    )
                    Spacer(modifier = Modifier.height(20.dp))
                    Button(
                        onClick = { launcher.launch(Manifest.permission.CAMERA) },
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Παραχώρηση Πρόσβασης στην Κάμερα")
                    }
                }
            }
        }
    }
}
