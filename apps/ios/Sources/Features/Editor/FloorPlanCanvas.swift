import SwiftUI

struct FloorPlanCanvas: View {
  @ObservedObject var viewModel: FloorPlanEditorViewModel

  var body: some View {
    GeometryReader { geo in
      Canvas { context, size in
        viewModel.draw(in: context, size: size)
      }
      .contentShape(Rectangle())
      .gesture(
        DragGesture(minimumDistance: 0)
          .onChanged { value in
            viewModel.handleDragChanged(value, in: geo.size)
          }
          .onEnded { value in
            viewModel.handleDragEnded(value, in: geo.size)
          }
      )
    }
  }
}
