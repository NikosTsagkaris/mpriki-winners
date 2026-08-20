package com.ntvelop.mprikiwinners.data.repository

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.google.firebase.functions.FirebaseFunctions
import com.ntvelop.mprikiwinners.domain.model.LeaderboardEntry
import com.ntvelop.mprikiwinners.domain.model.ScanResult
import com.ntvelop.mprikiwinners.domain.model.User
import com.ntvelop.mprikiwinners.domain.model.UserProfile
import com.ntvelop.mprikiwinners.domain.model.WonPrize
import com.ntvelop.mprikiwinners.domain.repository.AuthRepository
import com.ntvelop.mprikiwinners.domain.repository.LeaderboardRepository
import com.ntvelop.mprikiwinners.domain.repository.ProfileRepository
import com.ntvelop.mprikiwinners.domain.repository.ScannerRepository
import com.ntvelop.mprikiwinners.domain.util.MonthlyDrawSchedule
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import java.net.URLEncoder
import java.text.SimpleDateFormat
import java.util.Collections
import java.util.Date
import java.util.Locale

class AuthRepositoryImpl(
    private val firebaseAuth: FirebaseAuth = FirebaseAuth.getInstance(),
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance()
) : AuthRepository {

    override fun getCurrentUser(): User? {
        val fbUser = firebaseAuth.currentUser ?: return null
        return User(
            uid = fbUser.uid,
            email = fbUser.email ?: "",
            displayName = fbUser.displayName ?: fbUser.email?.substringBefore("@") ?: "User"
        )
    }

    override suspend fun signInWithEmail(email: String, pass: String): Result<User> {
        return try {
            val authResult = firebaseAuth.signInWithEmailAndPassword(email, pass).await()
            val fbUser = authResult.user ?: return Result.failure(Exception("User not found"))
            val user = User(
                uid = fbUser.uid,
                email = fbUser.email ?: email,
                displayName = fbUser.displayName ?: email.substringBefore("@")
            )

            ensureUserDocumentExists(user.uid, user.email ?: "", user.displayName ?: "User")
            Result.success(user)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun signUpWithEmail(email: String, pass: String): Result<User> {
        return try {
            val authResult = firebaseAuth.createUserWithEmailAndPassword(email, pass).await()
            val fbUser = authResult.user ?: return Result.failure(Exception("Registration failed"))
            val user = User(
                uid = fbUser.uid,
                email = fbUser.email ?: email,
                displayName = fbUser.displayName ?: email.substringBefore("@")
            )

            ensureUserDocumentExists(user.uid, user.email ?: "", user.displayName ?: "User")
            Result.success(user)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun signInWithGoogleIdToken(idToken: String): Result<User> {
        return try {
            val credential = com.google.firebase.auth.GoogleAuthProvider.getCredential(idToken, null)
            val authResult = firebaseAuth.signInWithCredential(credential).await()
            val fbUser = authResult.user ?: return Result.failure(Exception("Google Sign-In failed"))
            val user = User(
                uid = fbUser.uid,
                email = fbUser.email ?: "",
                displayName = fbUser.displayName ?: fbUser.email?.substringBefore("@") ?: "User"
            )

            ensureUserDocumentExists(user.uid, user.email ?: "", user.displayName ?: "User")
            Result.success(user)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private suspend fun ensureUserDocumentExists(uid: String, email: String, displayName: String) {
        try {
            val userRef = firestore.collection("users").document(uid)
            val doc = userRef.get().await()
            val defaultNextDraw = MonthlyDrawSchedule.getNextDrawTimeMillis()
            if (!doc.exists()) {
                val userDoc = mapOf(
                    "uid" to uid,
                    "email" to email,
                    "displayName" to displayName,
                    "totalMonthlyEntries" to 0,
                    "nextDrawTimeMillis" to defaultNextDraw,
                    "prizeHistory" to emptyList<Map<String, Any>>()
                )
                userRef.set(userDoc, com.google.firebase.firestore.SetOptions.merge()).await()
            } else {
                val updates = mutableMapOf<String, Any>()
                if (doc.getString("email").isNullOrBlank()) updates["email"] = email
                if (doc.getString("displayName").isNullOrBlank()) updates["displayName"] = displayName
                if (!doc.contains("nextDrawTimeMillis")) updates["nextDrawTimeMillis"] = defaultNextDraw
                if (!doc.contains("prizeHistory")) updates["prizeHistory"] = emptyList<Map<String, Any>>()
                if (updates.isNotEmpty()) {
                    userRef.set(updates, com.google.firebase.firestore.SetOptions.merge()).await()
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    override suspend fun signOut() {
        firebaseAuth.signOut()
    }
}

class ScannerRepositoryImpl(
    private val firebaseFunctions: FirebaseFunctions = FirebaseFunctions.getInstance(),
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance(),
    private val auth: FirebaseAuth = FirebaseAuth.getInstance()
) : ScannerRepository {

    // Local in-memory session cache of scanned QR tokens
    private val scannedQrCache = Collections.synchronizedSet(mutableSetOf<String>())

    override suspend fun validateQrToken(qrContent: String): Result<ScanResult> {
        // 0. Check local session cache first
        if (scannedQrCache.contains(qrContent)) {
            return Result.success(ScanResult.InvalidOrRedeemed("Αυτό το QR Code έχει ήδη χρησιμοποιηθεί."))
        }

        return try {
            val currentUserId = auth.currentUser?.uid ?: "anonymous_user"
            val safeDocId = URLEncoder.encode(qrContent, "UTF-8").replace(".", "_")

            val tokenRef = firestore.collection("qr_tokens").document(safeDocId)
            val userRef = firestore.collection("users").document(currentUserId)

            val scanResult = firestore.runTransaction { transaction ->
                // READS FIRST (Strict Firestore Transaction Rule: All reads must happen before any writes)
                val tokenDoc = transaction.get(tokenRef)
                val userDoc = transaction.get(userRef)

                if (tokenDoc.exists()) {
                    val isRedeemed = tokenDoc.getBoolean("redeemed") ?: false
                    if (isRedeemed) {
                        return@runTransaction ScanResult.InvalidOrRedeemed("Αυτό το QR Code έχει ήδη χρησιμοποιηθεί.")
                    }

                    val type = tokenDoc.getString("type") ?: "ENTRY"

                    // WRITES AFTER ALL READS ARE COMPLETED
                    transaction.update(
                        tokenRef, mapOf(
                            "redeemed" to true,
                            "scannedBy" to currentUserId,
                            "scannedAt" to System.currentTimeMillis()
                        )
                    )

                    when (type) {
                        "COFFEE" -> {
                            val prizeName = "1+1 Καφές"
                            addPrizeToUserHistory(transaction, userRef, userDoc, prizeName)
                            recordWeeklyWinner(prizeName)

                            ScanResult.InstantWin(
                                prizeName = prizeName,
                                claimCode = "MPRIKI-${(1000..9999).random()}",
                                redeemInstructions = "Δείξτε αυτόν τον κωδικό στο ταμείο για να λάβετε 1+1 Δωρεάν Καφέ!"
                            )
                        }
                        "ENTRY" -> {
                            val currentEntries = (userDoc.getLong("totalMonthlyEntries") ?: 0).toInt()
                            val newTotal = currentEntries + 1
                            transaction.set(userRef, mapOf("totalMonthlyEntries" to newTotal), com.google.firebase.firestore.SetOptions.merge())

                            ScanResult.MonthlyEntry(
                                entryNumber = newTotal,
                                totalActiveEntries = newTotal,
                                message = "1 Συμμετοχή στην κλήρωση καταχωρήθηκε επιτυχώς!"
                            )
                        }
                        else -> {
                            ScanResult.InvalidOrRedeemed("Δεν Κερδίσατε τίποτα")
                        }
                    }
                } else {
                    // First time scanning this dynamic QR code string! Perform ALL writes after reads
                    val detectedType = when {
                        qrContent.contains("COFFEE", ignoreCase = true) || qrContent.contains("1+1", ignoreCase = true) -> "COFFEE"
                        qrContent.contains("ENTRY", ignoreCase = true) -> "ENTRY"
                        else -> "NONE"
                    }

                    transaction.set(
                        tokenRef, mapOf(
                            "redeemed" to true,
                            "scannedBy" to currentUserId,
                            "scannedAt" to System.currentTimeMillis(),
                            "type" to detectedType
                        )
                    )

                    when (detectedType) {
                        "COFFEE" -> {
                            val prizeName = "1+1 Καφές"
                            addPrizeToUserHistory(transaction, userRef, userDoc, prizeName)
                            recordWeeklyWinner(prizeName)

                            ScanResult.InstantWin(
                                prizeName = prizeName,
                                claimCode = "MPRIKI-${(1000..9999).random()}",
                                redeemInstructions = "Δείξτε αυτόν τον κωδικό στο ταμείο για να λάβετε 1+1 Δωρεάν Καφέ!"
                            )
                        }
                        "ENTRY" -> {
                            val currentEntries = (userDoc.getLong("totalMonthlyEntries") ?: 0).toInt()
                            val newTotal = currentEntries + 1
                            transaction.set(userRef, mapOf("totalMonthlyEntries" to newTotal), com.google.firebase.firestore.SetOptions.merge())

                            ScanResult.MonthlyEntry(
                                entryNumber = newTotal,
                                totalActiveEntries = newTotal,
                                message = "1 Συμμετοχή στην κλήρωση καταχωρήθηκε επιτυχώς!"
                            )
                        }
                        else -> {
                            ScanResult.InvalidOrRedeemed("Δεν Κερδίσατε τίποτα")
                        }
                    }
                }
            }.await()

            scannedQrCache.add(qrContent)
            Result.success(scanResult)
        } catch (e: Exception) {
            e.printStackTrace()
            val currentUserId = auth.currentUser?.uid ?: "anonymous_user"

            if (scannedQrCache.contains(qrContent)) {
                return Result.success(ScanResult.InvalidOrRedeemed("Αυτό το QR Code έχει ήδη χρησιμοποιηθεί."))
            }

            scannedQrCache.add(qrContent)

            when {
                qrContent.contains("COFFEE", ignoreCase = true) || qrContent.contains("1+1", ignoreCase = true) -> {
                    val prizeName = "1+1 Καφές"
                    recordWeeklyWinner(prizeName)
                    Result.success(
                        ScanResult.InstantWin(
                            prizeName = prizeName,
                            claimCode = "MPRIKI-${(1000..9999).random()}",
                            redeemInstructions = "Δείξτε αυτόν τον κωδικό στο ταμείο για να λάβετε 1+1 Δωρεάν Καφέ!"
                        )
                    )
                }
                qrContent.contains("ENTRY", ignoreCase = true) -> {
                    val newTotal = incrementUserMonthlyEntries(currentUserId)
                    Result.success(
                        ScanResult.MonthlyEntry(
                            entryNumber = newTotal,
                            totalActiveEntries = newTotal,
                            message = "1 Συμμετοχή στην κλήρωση καταχωρήθηκε επιτυχώς!"
                        )
                    )
                }
                else -> {
                    Result.success(
                        ScanResult.InvalidOrRedeemed("Δεν Κερδίσατε τίποτα")
                    )
                }
            }
        }
    }

    @Suppress("UNCHECKED_CAST")
    private fun addPrizeToUserHistory(
        transaction: com.google.firebase.firestore.Transaction,
        userRef: com.google.firebase.firestore.DocumentReference,
        userDoc: com.google.firebase.firestore.DocumentSnapshot,
        prizeName: String
    ) {
        try {
            val currentHistory = (userDoc.get("prizeHistory") as? List<Map<String, Any>> ?: emptyList()).toMutableList()
            val dateFormat = SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.getDefault())
            val newPrizeMap = mapOf(
                "id" to "prize_${System.currentTimeMillis()}",
                "prizeName" to prizeName,
                "dateWonFormatted" to dateFormat.format(Date()),
                "isRedeemed" to false
            )
            currentHistory.add(0, newPrizeMap)
            transaction.set(userRef, mapOf("prizeHistory" to currentHistory), com.google.firebase.firestore.SetOptions.merge())
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun recordWeeklyWinner(prizeName: String) {
        try {
            val currentUser = auth.currentUser
            val userName = currentUser?.displayName ?: currentUser?.email?.substringBefore("@") ?: "Νικητής"
            val maskedName = if (userName.length <= 3) "${userName.take(1)}***" else "${userName.take(1)}***${userName.takeLast(1)}"

            val winnerMap = mapOf(
                "username" to userName,
                "maskedUsername" to maskedName,
                "prizeWon" to prizeName,
                "timestampMillis" to System.currentTimeMillis()
            )
            firestore.collection("weekly_winners").add(winnerMap)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private suspend fun incrementUserMonthlyEntries(userId: String): Int {
        return try {
            val userRef = firestore.collection("users").document(userId)
            val currentUser = auth.currentUser
            val email = currentUser?.email ?: ""
            val displayName = currentUser?.displayName ?: email.substringBefore("@").ifBlank { "User" }
            val defaultNextDraw = MonthlyDrawSchedule.getNextDrawTimeMillis()

            firestore.runTransaction { transaction ->
                val snapshot = transaction.get(userRef)
                val currentEntries = (snapshot.getLong("totalMonthlyEntries") ?: 0).toInt()
                val newTotal = currentEntries + 1

                val dataToSet = mutableMapOf<String, Any>(
                    "totalMonthlyEntries" to newTotal,
                    "uid" to userId
                )
                if (email.isNotBlank()) dataToSet["email"] = email
                if (displayName.isNotBlank()) dataToSet["displayName"] = displayName
                if (!snapshot.contains("nextDrawTimeMillis")) dataToSet["nextDrawTimeMillis"] = defaultNextDraw

                transaction.set(userRef, dataToSet, com.google.firebase.firestore.SetOptions.merge())
                newTotal
            }.await()
        } catch (e: Exception) {
            1
        }
    }
}

class LeaderboardRepositoryImpl(
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance()
) : LeaderboardRepository {

    override fun getWeeklyLeaderboardStream(): Flow<List<LeaderboardEntry>> = callbackFlow {
        val listenerRegistration = firestore.collection("weekly_winners")
            .orderBy("timestampMillis", Query.Direction.DESCENDING)
            .limit(20)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    if (error.code == com.google.firebase.firestore.FirebaseFirestoreException.Code.PERMISSION_DENIED) {
                        trySend(emptyList())
                    } else {
                        close(error)
                    }
                    return@addSnapshotListener
                }

                if (snapshot != null && !snapshot.isEmpty) {
                    val entries = snapshot.documents.mapIndexed { index, doc ->
                        LeaderboardEntry(
                            id = doc.id,
                            rank = index + 1,
                            maskedUsername = doc.getString("maskedUsername") ?: maskName(doc.getString("username") ?: "Νικητής"),
                            prizeWon = doc.getString("prizeWon") ?: "1+1 Καφές",
                            timestampMillis = doc.getLong("timestampMillis") ?: System.currentTimeMillis()
                        )
                    }
                    trySend(entries)
                } else {
                    trySend(emptyList())
                }
            }

        awaitClose { listenerRegistration.remove() }
    }

    private fun maskName(name: String): String {
        if (name.length <= 3) return "${name.take(1)}***"
        val parts = name.split(" ")
        return parts.joinToString(" ") { part ->
            if (part.length <= 2) "${part.take(1)}*"
            else "${part.take(1)}${"*".repeat(part.length - 2)}${part.takeLast(1)}"
        }
    }
}

class ProfileRepositoryImpl(
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance(),
    private val auth: FirebaseAuth = FirebaseAuth.getInstance()
) : ProfileRepository {

    override fun getUserProfileStream(uid: String): Flow<UserProfile> = callbackFlow {
        val listenerRegistration = firestore.collection("users").document(uid)
            .addSnapshotListener { snapshot, error ->
                val currentFbUser = auth.currentUser
                val email = currentFbUser?.email ?: ""
                val name = currentFbUser?.displayName ?: if (email.contains("@")) email.substringBefore("@").replaceFirstChar { it.uppercase() } else "Χρήστης"
                val defaultNextDraw = MonthlyDrawSchedule.getNextDrawTimeMillis()

                if (error != null) {
                    trySend(UserProfile(uid = uid, displayName = name, email = email, totalMonthlyEntries = 0, nextDrawTimeMillis = defaultNextDraw, prizeHistory = emptyList()))
                    return@addSnapshotListener
                }

                if (snapshot != null && snapshot.exists()) {
                    val entries = (snapshot.getLong("totalMonthlyEntries") ?: 0).toInt()
                    val nextDraw = snapshot.getLong("nextDrawTimeMillis") ?: defaultNextDraw

                    @Suppress("UNCHECKED_CAST")
                    val rawHistory = snapshot.get("prizeHistory") as? List<Map<String, Any>> ?: emptyList()
                    val history = rawHistory.mapIndexed { idx, map ->
                        WonPrize(
                            id = map["id"] as? String ?: "p_$idx",
                            prizeName = map["prizeName"] as? String ?: "1+1 Καφές",
                            dateWonFormatted = map["dateWonFormatted"] as? String ?: "Πρόσφατα",
                            isRedeemed = map["isRedeemed"] as? Boolean ?: true
                        )
                    }

                    trySend(
                        UserProfile(
                            uid = uid,
                            displayName = name,
                            email = email,
                            totalMonthlyEntries = entries,
                            nextDrawTimeMillis = nextDraw,
                            prizeHistory = history
                        )
                    )
                } else {
                    trySend(
                        UserProfile(
                            uid = uid,
                            displayName = name,
                            email = email,
                            totalMonthlyEntries = 0,
                            nextDrawTimeMillis = defaultNextDraw,
                            prizeHistory = emptyList()
                        )
                    )
                }
            }

        awaitClose { listenerRegistration.remove() }
    }
}
