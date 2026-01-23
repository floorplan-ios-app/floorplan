import SwiftUI

struct SettingsView: View {
  @StateObject private var viewModel = SettingsViewModel()

  var body: some View {
    List {
      Section("Device Pairing") {
        Button("Create pairing code") {
          Task { await viewModel.createPairingCode() }
        }
        if let code = viewModel.pairingCode {
          VStack(alignment: .leading, spacing: 4) {
            Text(code)
              .font(.title2)
              .fontWeight(.semibold)
            if let expiresAt = viewModel.pairingExpiresAt {
              Text("Expires \(expiresAt)")
                .font(.caption)
                .foregroundStyle(.secondary)
            }
          }
        }
      }

      Section("Devices") {
        if viewModel.isLoading {
          HStack {
            ProgressView()
            Text("Loading…")
          }
        }
        if let message = viewModel.errorMessage {
          Text(message)
            .foregroundStyle(.red)
        }
        if viewModel.devices.isEmpty && !viewModel.isLoading {
          Text("No devices yet.")
            .foregroundStyle(.secondary)
        }
        ForEach(viewModel.devices) { device in
          HStack {
            VStack(alignment: .leading, spacing: 4) {
              Text(device.name ?? device.id.uuidString)
                .font(.headline)
              if let deviceType = device.deviceType {
                Text(deviceType)
                  .font(.caption)
                  .foregroundStyle(.secondary)
              }
            }
            Spacer()
            Button("Revoke") {
              Task { await viewModel.revokeDevice(id: device.id) }
            }
            .disabled(device.revokedAt != nil)
          }
        }
      }
    }
    .navigationTitle("Settings")
    .task {
      await viewModel.loadDevices()
    }
  }
}

extension DeviceSummary: Identifiable {}
