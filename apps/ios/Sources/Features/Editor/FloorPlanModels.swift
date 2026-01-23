import Foundation
import SwiftUI

struct FloorPlanData: Equatable, Codable {
  var nodes: [FloorPlanNode]
  var walls: [FloorPlanWall]

  static let empty = FloorPlanData(nodes: [], walls: [])
}

struct FloorPlanNode: Identifiable, Hashable, Codable {
  let id: UUID
  var x: Int
  var y: Int
}

struct FloorPlanOpening: Identifiable, Hashable, Codable {
  let id: UUID
  var type: OpeningType
  var offset: Int
  var width: Int
}

enum OpeningType: String, Codable, CaseIterable, Identifiable {
  case door
  case window

  var id: String { rawValue }
}

struct FloorPlanWall: Identifiable, Hashable, Codable {
  let id: UUID
  var startNodeId: UUID
  var endNodeId: UUID
  var thickness: Int
  var openings: [FloorPlanOpening] = []
}

struct FloorPlanGrid {
  let minorStepMM: Int
  let majorStepMM: Int
  let snapStepMM: Int
}

struct FloorPlanCanvasTheme {
  let background: Color
  let gridMinor: Color
  let gridMajor: Color
  let wallStroke: Color
  let openingStroke: Color
  let nodeFill: Color
  let nodeSelected: Color
  let previewStroke: Color
}

struct FloorPlanDefaults {
  static let grid = FloorPlanGrid(minorStepMM: 100, majorStepMM: 1000, snapStepMM: 100)
  static let theme = FloorPlanCanvasTheme(
    background: Color(.sRGB, white: 0.98, opacity: 1),
    gridMinor: Color(.sRGB, white: 0.9, opacity: 1),
    gridMajor: Color(.sRGB, white: 0.78, opacity: 1),
    wallStroke: Color.primary,
    openingStroke: Color.green,
    nodeFill: Color.blue,
    nodeSelected: Color.orange,
    previewStroke: Color.orange.opacity(0.7)
  )
}
