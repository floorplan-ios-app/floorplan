import Foundation

@MainActor
final class SettingsViewModel: ObservableObject {
  @Published var pairingCode: String?
  @Published var pairingExpiresAt: String?
  @Published var devices: [DeviceSummary] = []
  @Published var errorMessage: String?
  @Published var isLoading = false

  private let apiClient: ApiClient

  init(apiClient: ApiClient = .shared) {
    self.apiClient = apiClient
  }

  func loadDevices() async {
    isLoading = true
    errorMessage = nil
    do {
      devices = try await apiClient.listDevices()
    } catch {
      errorMessage = "Failed to load devices."
    }
    isLoading = false
  }

  func createPairingCode() async {
    isLoading = true
    errorMessage = nil
    do {
      let result = try await apiClient.createPairingCode(deviceName: "iOS", deviceType: "ios")
      pairingCode = result.code
      pairingExpiresAt = result.expiresAt
    } catch {
      errorMessage = "Failed to create pairing code."
    }
    isLoading = false
  }

  func revokeDevice(id: UUID) async {
    isLoading = true
    errorMessage = nil
    do {
      _ = try await apiClient.revokeDevice(deviceId: id)
      devices.removeAll { $0.id == id }
    } catch {
      errorMessage = "Failed to revoke device."
    }
    isLoading = false
  }
}
