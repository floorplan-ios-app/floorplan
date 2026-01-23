import SwiftUI

struct ContentView: View {
  var body: some View {
    TabView {
      ProjectHomeView()
        .tabItem {
          Label("Projects", systemImage: "square.grid.2x2")
        }
        .accessibilityIdentifier("tab-projects")
      SettingsView()
        .tabItem {
          Label("Settings", systemImage: "gearshape")
        }
        .accessibilityIdentifier("tab-settings")
    }
  }
}
