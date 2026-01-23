import Foundation

@MainActor
final class SettingsViewModel: ObservableObject {
  @Published var pairingCode: String?
  @Published var pairingExpiresAt: String?
  @Published var devices: [DeviceSummary] = []
  @Published var errorMessage: String?
  @Published var isLoading = false
  @Published var baseURL = ""
  @Published var deviceId = "unknown"

  private let apiClient: ApiClient

  init(apiClient: ApiClient = .shared) {
    self.apiClient = apiClient
    self.baseURL = apiClient.baseURLString
    self.deviceId = apiClient.deviceIdString
  }

  func loadDevices() async {
    isLoading = true
    errorMessage = nil
    defer { isLoading = false }
    do {
      devices = try await apiClient.listDevices()
    } catch {
      if (error as? CancellationError) == nil {
        errorMessage = "Failed to load devices. \(describe(error))"
      }
    }
  }

  func createPairingCode() async {
    isLoading = true
    errorMessage = nil
    defer { isLoading = false }
    do {
      let result = try await apiClient.createPairingCode(deviceName: "iOS", deviceType: "ios")
      pairingCode = result.code
      pairingExpiresAt = result.expiresAt
      await loadDevices()
    } catch {
      if (error as? CancellationError) == nil {
        errorMessage = "Failed to create pairing code. \(describe(error))"
      }
    }
  }

  func revokeDevice(id: UUID) async {
    isLoading = true
    errorMessage = nil
    defer { isLoading = false }
    do {
      _ = try await apiClient.revokeDevice(deviceId: id)
      devices.removeAll { $0.id == id }
    } catch {
      if (error as? CancellationError) == nil {
        errorMessage = "Failed to revoke device. \(describe(error))"
      }
    }
  }
}

private func describe(_ error: Error) -> String {
  let nsError = error as NSError
  if let body = nsError.userInfo["body"] as? String, !body.isEmpty {
    return body
  }
  if nsError.domain == NSURLErrorDomain {
    return "\(nsError.localizedDescription) (code \(nsError.code))"
  }
  if !nsError.localizedDescription.isEmpty {
    return nsError.localizedDescription
  }
  return "Unknown error."
}
