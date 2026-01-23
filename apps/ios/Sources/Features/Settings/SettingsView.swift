import SwiftUI

struct SettingsView: View {
  @StateObject private var viewModel = SettingsViewModel()

  var body: some View {
    List {
      Section("Server") {
        Text(viewModel.baseURL)
          .font(.caption)
          .foregroundStyle(.secondary)
      }
      Section("Session") {
        Text("Device ID: \(viewModel.deviceId)")
          .font(.caption)
          .foregroundStyle(.secondary)
      }
      if let message = viewModel.errorMessage {
        Section {
          Text(message)
            .foregroundStyle(.red)
        }
      }
      Section("Device Pairing") {
        Button {
          Task { await viewModel.createPairingCode() }
        } label: {
          Text("Create pairing code")
        }
        .accessibilityIdentifier("pairing-create")
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
    .onAppear {
      Task { await viewModel.loadDevices() }
    }
  }
}

extension DeviceSummary: Identifiable {}
