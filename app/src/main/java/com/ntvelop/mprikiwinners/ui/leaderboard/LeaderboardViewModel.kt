package com.ntvelop.mprikiwinners.ui.leaderboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ntvelop.mprikiwinners.data.repository.LeaderboardRepositoryImpl
import com.ntvelop.mprikiwinners.domain.model.LeaderboardEntry
import com.ntvelop.mprikiwinners.domain.repository.LeaderboardRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.launch

sealed interface LeaderboardUiState {
    data object Loading : LeaderboardUiState
    data class Success(val entries: List<LeaderboardEntry>) : LeaderboardUiState
    data class Error(val message: String) : LeaderboardUiState
}

class LeaderboardViewModel(
    private val leaderboardRepository: LeaderboardRepository = LeaderboardRepositoryImpl()
) : ViewModel() {

    private val _uiState = MutableStateFlow<LeaderboardUiState>(LeaderboardUiState.Loading)
    val uiState: StateFlow<LeaderboardUiState> = _uiState.asStateFlow()

    init {
        observeLeaderboard()
    }

    private fun observeLeaderboard() {
        viewModelScope.launch {
            _uiState.value = LeaderboardUiState.Loading
            leaderboardRepository.getWeeklyLeaderboardStream()
                .catch { e ->
                    _uiState.value = LeaderboardUiState.Error(e.localizedMessage ?: "Unable to fetch leaderboard")
                }
                .collect { list ->
                    _uiState.value = LeaderboardUiState.Success(list)
                }
        }
    }
}
