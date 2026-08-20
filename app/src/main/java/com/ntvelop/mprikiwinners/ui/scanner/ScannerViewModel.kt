package com.ntvelop.mprikiwinners.ui.scanner

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ntvelop.mprikiwinners.data.repository.ScannerRepositoryImpl
import com.ntvelop.mprikiwinners.domain.model.ScanResult
import com.ntvelop.mprikiwinners.domain.repository.ScannerRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface ScannerUiState {
    data object Idle : ScannerUiState
    data class ValidatingToken(val qrToken: String) : ScannerUiState
    data class ShowResult(val result: ScanResult) : ScannerUiState
    data class Error(val message: String) : ScannerUiState
}

class ScannerViewModel(
    private val scannerRepository: ScannerRepository = ScannerRepositoryImpl()
) : ViewModel() {

    private val _uiState = MutableStateFlow<ScannerUiState>(ScannerUiState.Idle)
    val uiState: StateFlow<ScannerUiState> = _uiState.asStateFlow()

    private var isProcessingScan: Boolean = false

    fun onQrScanned(qrContent: String) {
        if (isProcessingScan || _uiState.value is ScannerUiState.ValidatingToken) return

        isProcessingScan = true
        _uiState.value = ScannerUiState.ValidatingToken(qrContent)

        viewModelScope.launch {
            val result = scannerRepository.validateQrToken(qrContent)
            result.fold(
                onSuccess = { scanResult ->
                    _uiState.value = ScannerUiState.ShowResult(scanResult)
                },
                onFailure = { error ->
                    _uiState.value = ScannerUiState.Error(error.localizedMessage ?: "Failed to validate QR code.")
                }
            )
        }
    }

    fun dismissResultDialog() {
        isProcessingScan = false
        _uiState.value = ScannerUiState.Idle
    }
}
