import SwiftUI

struct EditorView: View {
  let project: ProjectSummary?

  var body: some View {
    VStack(spacing: 12) {
      Text("Editor (stub)")
        .font(.headline)
      Text("Implement 2D floorplan editor, 3D view, and AR preview.")
        .foregroundStyle(.secondary)
    }
    .padding()
    .navigationTitle(project?.name ?? "Editor")
  }
}
