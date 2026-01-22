import SwiftUI

struct ContentView: View {
  var body: some View {
    NavigationStack {
      VStack(alignment: .leading, spacing: 12) {
        Text("Floor Plan Tracer")
          .font(.title)
        Text("Scaffold app. Next: Editor Shell + Project List.")
          .foregroundStyle(.secondary)

        NavigationLink("Open Editor (stub)") {
          EditorView()
        }
      }
      .padding()
      .navigationTitle("Home")
    }
  }
}
