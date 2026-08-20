package com.ntvelop.mprikiwinners.domain.repository

import com.ntvelop.mprikiwinners.domain.model.LeaderboardEntry
import com.ntvelop.mprikiwinners.domain.model.ScanResult
import com.ntvelop.mprikiwinners.domain.model.User
import com.ntvelop.mprikiwinners.domain.model.UserProfile
import kotlinx.coroutines.flow.Flow

interface AuthRepository {
    suspend fun signInWithEmail(email: String, pass: String): Result<User>
    suspend fun signUpWithEmail(email: String, pass: String): Result<User>
    suspend fun signInWithGoogleIdToken(idToken: String): Result<User>
    fun getCurrentUser(): User?
    suspend fun signOut()
}

interface ScannerRepository {
    suspend fun validateQrToken(qrContent: String): Result<ScanResult>
}

interface LeaderboardRepository {
    fun getWeeklyLeaderboardStream(): Flow<List<LeaderboardEntry>>
}

interface ProfileRepository {
    fun getUserProfileStream(uid: String): Flow<UserProfile>
}
