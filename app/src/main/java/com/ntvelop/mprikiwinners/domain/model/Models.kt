package com.ntvelop.mprikiwinners.domain.model

data class User(
    val uid: String,
    val email: String,
    val displayName: String? = null
)

sealed interface ScanResult {
    data class InstantWin(
        val prizeName: String = "1+1 Καφές",
        val claimCode: String,
        val redeemInstructions: String = "Δείξτε αυτόν τον κωδικό στο ταμείο για να λάβετε 1+1 Δωρεάν Καφέ!"
    ) : ScanResult

    data class MonthlyEntry(
        val entryNumber: Int,
        val totalActiveEntries: Int,
        val message: String = "1 Συμμετοχή στην κλήρωση καταχωρήθηκε επιτυχώς!"
    ) : ScanResult

    data class InvalidOrRedeemed(
        val reason: String = "Δεν Κερδίσατε τίποτα"
    ) : ScanResult
}

data class LeaderboardEntry(
    val id: String,
    val rank: Int,
    val maskedUsername: String,
    val prizeWon: String,
    val timestampMillis: Long
)

data class WonPrize(
    val id: String,
    val prizeName: String,
    val dateWonFormatted: String,
    val isRedeemed: Boolean
)

data class UserProfile(
    val uid: String,
    val displayName: String,
    val email: String,
    val totalMonthlyEntries: Int,
    val nextDrawTimeMillis: Long,
    val prizeHistory: List<WonPrize>
)
