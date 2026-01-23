import SwiftUI

struct EditorView: View {
  let project: ProjectSummary?
  @StateObject private var viewModel: FloorPlanEditorViewModel
  private let relativeFormatter = RelativeDateTimeFormatter()

  init(project: ProjectSummary?) {
    self.project = project
    _viewModel = StateObject(wrappedValue: FloorPlanEditorViewModel(projectId: project?.id))
  }

  var body: some View {
    VStack(spacing: 12) {
      if viewModel.isLoading {
        HStack {
          ProgressView()
          Text("Loading local floor plan…")
        }
      }

      if let message = viewModel.errorMessage {
        Text(message)
          .foregroundStyle(.red)
      }

      HStack {
        Picker("Tool", selection: $viewModel.tool) {
          ForEach(FloorPlanEditorTool.allCases) { tool in
            Text(tool.rawValue)
              .tag(tool)
              .accessibilityIdentifier("tool-\(tool.rawValue.lowercased())")
          }
        }
        .pickerStyle(.segmented)

        Spacer()

        if viewModel.tool == .opening {
          Picker("Opening", selection: $viewModel.openingType) {
            ForEach(OpeningType.allCases) { opening in
              Text(opening.rawValue.capitalized).tag(opening)
            }
          }
          .pickerStyle(.segmented)
          .frame(maxWidth: 180)
        }

        VStack(alignment: .trailing, spacing: 4) {
          Text("Nodes: \(viewModel.floorPlan.nodes.count)")
          Text("Walls: \(viewModel.floorPlan.walls.count)")
          if let saveStatus = saveStatusText() {
            Text(saveStatus)
          }
        }
        .font(.caption)
        .foregroundStyle(.secondary)
      }

      ZStack {
        FloorPlanCanvas(viewModel: viewModel)
          .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
          .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
              .stroke(Color(white: 0.85), lineWidth: 1)
          )
          .simultaneousGesture(
            MagnificationGesture()
              .onChanged { value in
                viewModel.handleMagnificationChanged(value)
              }
              .onEnded { _ in
                viewModel.handleMagnificationEnded()
              }
          )

        if viewModel.floorPlan.nodes.isEmpty {
          VStack(spacing: 8) {
            Text("Start drawing")
              .font(.headline)
            Text("Drag to place nodes and draw walls. Use Select to move nodes.")
              .font(.subheadline)
              .foregroundStyle(.secondary)
              .multilineTextAlignment(.center)
          }
          .padding(24)
          .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity)

      Text(footerText(for: viewModel.tool))
        .font(.footnote)
        .foregroundStyle(.secondary)
    }
    .padding()
    .navigationTitle(project?.name ?? "Editor")
    .task {
      await viewModel.load()
    }
  }

  private func footerText(for tool: FloorPlanEditorTool) -> String {
    switch tool {
    case .drawWall:
      return "Draw: drag to create walls."
    case .select:
      return "Select: drag nodes to reposition."
    case .pan:
      return "Pan: drag to move the canvas. Pinch to zoom."
    case .opening:
      return "Opening: tap a wall to add a door or window."
    }
  }

  private func saveStatusText() -> String? {
    if viewModel.isSaving {
      return "Saving..."
    }
    guard let lastSavedAt = viewModel.lastSavedAt else { return nil }
    let relative = relativeFormatter.localizedString(for: lastSavedAt, relativeTo: Date())
    return "Saved \(relative)"
  }
}
