package com.ntvelop.mprikiwinners.ui.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.firestore.FirebaseFirestore
import com.ntvelop.mprikiwinners.data.repository.AuthRepositoryImpl
import com.ntvelop.mprikiwinners.data.repository.ProfileRepositoryImpl
import com.ntvelop.mprikiwinners.domain.model.UserProfile
import com.ntvelop.mprikiwinners.domain.repository.AuthRepository
import com.ntvelop.mprikiwinners.domain.repository.ProfileRepository
import com.ntvelop.mprikiwinners.domain.util.MonthlyDrawSchedule
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.launch

sealed interface ProfileUiState {
    data object Loading : ProfileUiState
    data class Success(val profile: UserProfile) : ProfileUiState
    data class Error(val message: String) : ProfileUiState
}

class ProfileViewModel(
    private val profileRepository: ProfileRepository = ProfileRepositoryImpl(),
    private val authRepository: AuthRepository = AuthRepositoryImpl()
) : ViewModel() {

    private val _uiState = MutableStateFlow<ProfileUiState>(ProfileUiState.Loading)
    val uiState: StateFlow<ProfileUiState> = _uiState.asStateFlow()

    init {
        loadUserProfile()
    }

    private fun loadUserProfile() {
        val currentUser = authRepository.getCurrentUser()
        val uid = currentUser?.uid ?: "demo_user_uid"

        viewModelScope.launch {
            _uiState.value = ProfileUiState.Loading
            profileRepository.getUserProfileStream(uid)
                .catch { e ->
                    _uiState.value = ProfileUiState.Error(e.localizedMessage ?: "Αποτυχία φόρτωσης προφίλ")
                }
                .collect { profile ->
                    _uiState.value = ProfileUiState.Success(profile)
                }
        }
    }

    fun triggerAutomatedMonthlyDrawWinner(profile: UserProfile) {
        viewModelScope.launch {
            try {
                val firestore = FirebaseFirestore.getInstance()
                val winnerName = if (profile.displayName.isNotBlank()) profile.displayName else profile.email.substringBefore("@")
                val masked = if (winnerName.length <= 3) "${winnerName.take(1)}***" else "${winnerName.take(1)}***${winnerName.takeLast(1)}"

                val winnerData = mapOf(
                    "username" to winnerName,
                    "maskedUsername" to masked,
                    "prizeWon" to "Μεγάλη Μηνιαία Κλήρωση: Gift Box",
                    "timestampMillis" to System.currentTimeMillis()
                )

                firestore.collection("weekly_winners").add(winnerData)

                val nextDraw = MonthlyDrawSchedule.getNextDrawTimeMillis(System.currentTimeMillis() + 1000L)
                firestore.collection("users").document(profile.uid).update("nextDrawTimeMillis", nextDraw)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    fun signOut(onSignedOut: () -> Unit) {
        viewModelScope.launch {
            authRepository.signOut()
            onSignedOut()
        }
    }
}
