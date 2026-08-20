package com.ntvelop.mprikiwinners.ui.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ExitToApp
import androidx.compose.material.icons.filled.CardGiftcard
import androidx.compose.material.icons.filled.ConfirmationNumber
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Timer
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ntvelop.mprikiwinners.domain.model.WonPrize
import com.ntvelop.mprikiwinners.domain.util.MonthlyDrawSchedule
import kotlinx.coroutines.delay

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MonthlyDrawProfileScreen(
    viewModel: ProfileViewModel,
    onSignOut: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    var latestDrawWinner by remember { mutableStateOf<String?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.Person,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.padding(end = 8.dp)
                        )
                        Text(
                            text = "Μηνιαία Μεγάλη Κλήρωση & Προφίλ",
                            style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold)
                        )
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.signOut(onSignOut) }) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ExitToApp,
                            contentDescription = "Αποσύνδεση",
                            tint = MaterialTheme.colorScheme.error
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface)
            )
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(MaterialTheme.colorScheme.surface)
        ) {
            when (val state = uiState) {
                is ProfileUiState.Loading -> {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator()
                    }
                }

                is ProfileUiState.Error -> {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(24.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = state.message,
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.bodyLarge
                        )
                    }
                }

                is ProfileUiState.Success -> {
                    val profile = state.profile

                    // Compute user avatar initial from email or display name
                    val userInitial = remember(profile.email, profile.displayName) {
                        when {
                            profile.email.isNotBlank() -> profile.email.trim().take(1).uppercase()
                            profile.displayName.isNotBlank() -> profile.displayName.trim().take(1).uppercase()
                            else -> "U"
                        }
                    }

                    LazyColumn(
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                        modifier = Modifier.fillMaxSize()
                    ) {
                        // User Banner Header with Email Initial Avatar
                        item {
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(20.dp),
                                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerHigh)
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(20.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Surface(
                                        modifier = Modifier.size(54.dp),
                                        shape = CircleShape,
                                        color = MaterialTheme.colorScheme.primaryContainer
                                    ) {
                                        Box(contentAlignment = Alignment.Center) {
                                            Text(
                                                text = userInitial,
                                                style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                                                color = MaterialTheme.colorScheme.onPrimaryContainer
                                            )
                                        }
                                    }
                                    Spacer(modifier = Modifier.width(16.dp))
                                    Column {
                                        Text(
                                            text = if (profile.displayName.isNotBlank()) profile.displayName else profile.email.substringBefore("@"),
                                            style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold)
                                        )
                                        Text(
                                            text = profile.email,
                                            style = MaterialTheme.typography.bodyMedium,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }
                                }
                            }
                        }

                        // Total Active Entries Ticket Card (Accurate scan description)
                        item {
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(20.dp),
                                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
                            ) {
                                Column(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(20.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.Center
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.ConfirmationNumber,
                                            contentDescription = null,
                                            tint = MaterialTheme.colorScheme.onPrimaryContainer,
                                            modifier = Modifier.size(28.dp)
                                        )
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Text(
                                            text = "Ενεργές Συμμετοχές Μηνιαίας Κλήρωσης",
                                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                                            color = MaterialTheme.colorScheme.onPrimaryContainer
                                        )
                                    }

                                    Spacer(modifier = Modifier.height(12.dp))

                                    Text(
                                        text = "${profile.totalMonthlyEntries}",
                                        style = MaterialTheme.typography.displayMedium.copy(
                                            fontWeight = FontWeight.ExtraBold,
                                            fontSize = 52.sp
                                        ),
                                        color = MaterialTheme.colorScheme.onPrimaryContainer
                                    )

                                    Text(
                                        text = "Οι επιτυχημένες συμμετοχές από τα σκαναρίσματα προστίθενται στη Μεγάλη Μηνιαία Κλήρωση!",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.8f),
                                        textAlign = TextAlign.Center
                                    )
                                }
                            }
                        }

                        // Live Countdown Timer Card with Automated Winner Drawing
                        item {
                            val nextDrawTime = remember(profile.nextDrawTimeMillis) {
                                if (profile.nextDrawTimeMillis <= System.currentTimeMillis()) {
                                    MonthlyDrawSchedule.getNextDrawTimeMillis()
                                } else {
                                    profile.nextDrawTimeMillis
                                }
                            }

                            CountdownTimerCard(
                                targetTimeMillis = nextDrawTime,
                                onTimerExpired = {
                                    latestDrawWinner = profile.displayName.ifBlank { profile.email }
                                    viewModel.triggerAutomatedMonthlyDrawWinner(profile)
                                }
                            )
                        }

                        // Winner Announcement Banner when timer expires
                        if (latestDrawWinner != null) {
                            item {
                                Surface(
                                    color = Color(0xFFFFD700).copy(alpha = 0.25f),
                                    shape = RoundedCornerShape(16.dp),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Row(
                                        modifier = Modifier.padding(16.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.EmojiEvents,
                                            contentDescription = null,
                                            tint = Color(0xFFD4AF37),
                                            modifier = Modifier.size(36.dp)
                                        )
                                        Spacer(modifier = Modifier.width(12.dp))
                                        Column {
                                            Text(
                                                text = "🎉 Νέος Νικητής Μηνιαίας Κλήρωσης!",
                                                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                                                color = MaterialTheme.colorScheme.onSurface
                                            )
                                            Text(
                                                text = "Ο/Η ${latestDrawWinner} αναδείχθηκε νικητής/τρια της μεγάλης κλήρωσης!",
                                                style = MaterialTheme.typography.bodySmall,
                                                color = MaterialTheme.colorScheme.onSurfaceVariant
                                            )
                                        }
                                    }
                                }
                            }
                        }

                        // Prize History Section Header
                        item {
                            Text(
                                text = "Ιστορικό Δώρων & Επιβραβεύσεων",
                                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                                modifier = Modifier.padding(top = 8.dp, bottom = 4.dp)
                            )
                        }

                        if (profile.prizeHistory.isEmpty()) {
                            item {
                                Surface(
                                    modifier = Modifier.fillMaxWidth(),
                                    shape = RoundedCornerShape(16.dp),
                                    color = MaterialTheme.colorScheme.surfaceContainerLow
                                ) {
                                    Text(
                                        text = "Δεν έχετε κερδίσει κάποιο δώρο ακόμα. Συνεχίστε το σκανάρισμα QR codes!",
                                        modifier = Modifier.padding(24.dp),
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        textAlign = TextAlign.Center
                                    )
                                }
                            }
                        } else {
                            items(profile.prizeHistory, key = { it.id }) { prize ->
                                PrizeHistoryItemCard(prize = prize)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun CountdownTimerCard(
    targetTimeMillis: Long,
    onTimerExpired: () -> Unit = {}
) {
    var remainingTimeMillis by remember { mutableLongStateOf(maxOf(0L, targetTimeMillis - System.currentTimeMillis())) }
    var hasFiredEvent by remember { mutableStateOf(false) }

    LaunchedEffect(targetTimeMillis) {
        while (remainingTimeMillis > 0) {
            delay(1000L)
            remainingTimeMillis = maxOf(0L, targetTimeMillis - System.currentTimeMillis())
        }

        if (remainingTimeMillis <= 0 && !hasFiredEvent) {
            hasFiredEvent = true
            onTimerExpired()
        }
    }

    val days = (remainingTimeMillis / (1000 * 60 * 60 * 24)).toInt()
    val hours = ((remainingTimeMillis / (1000 * 60 * 60)) % 24).toInt()
    val minutes = ((remainingTimeMillis / (1000 * 60)) % 60).toInt()
    val seconds = ((remainingTimeMillis / 1000) % 60).toInt()

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.Timer,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSecondaryContainer,
                    modifier = Modifier.size(24.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Η Επόμενη Μεγάλη Μηνιαία Κλήρωση σε:",
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                    color = MaterialTheme.colorScheme.onSecondaryContainer
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            Row(
                horizontalArrangement = Arrangement.SpaceEvenly,
                modifier = Modifier.fillMaxWidth()
            ) {
                TimerTimeUnitBlock(value = days, label = "Ημέρες")
                TimerTimeUnitBlock(value = hours, label = "Ώρες")
                TimerTimeUnitBlock(value = minutes, label = "Λεπτά")
                TimerTimeUnitBlock(value = seconds, label = "Δευτερόλεπτα")
            }
        }
    }
}

@Composable
fun TimerTimeUnitBlock(value: Int, label: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Surface(
            color = MaterialTheme.colorScheme.surface,
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.width(68.dp)
        ) {
            Box(
                modifier = Modifier.padding(vertical = 10.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = String.format("%02d", value),
                    style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold),
                    color = MaterialTheme.colorScheme.primary
                )
            }
        }
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSecondaryContainer.copy(alpha = 0.8f)
        )
    }
}

@Composable
fun PrizeHistoryItemCard(prize: WonPrize) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerHigh)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Surface(
                color = MaterialTheme.colorScheme.tertiaryContainer,
                shape = CircleShape,
                modifier = Modifier.size(44.dp)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = Icons.Default.CardGiftcard,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onTertiaryContainer,
                        modifier = Modifier.size(24.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.width(16.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = prize.prizeName,
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold)
                )
                Text(
                    text = "Κερδήθηκε στις ${prize.dateWonFormatted}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(modifier = Modifier.width(8.dp))

            Surface(
                color = if (prize.isRedeemed) Color(0xFFE8F5E9) else Color(0xFFFFF3E0),
                shape = RoundedCornerShape(8.dp)
            ) {
                Text(
                    text = if (prize.isRedeemed) "Εξαργυρώθηκε" else "Διαθέσιμο",
                    color = if (prize.isRedeemed) Color(0xFF2E7D32) else Color(0xFFE65100),
                    style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                )
            }
        }
    }
}
