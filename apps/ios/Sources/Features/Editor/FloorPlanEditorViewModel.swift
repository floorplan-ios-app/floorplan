import Foundation
import SwiftUI

enum FloorPlanEditorTool: String, CaseIterable, Identifiable {
  case select = "Select"
  case drawWall = "Draw"
  case pan = "Pan"
  case opening = "Opening"

  var id: String { rawValue }
}

@MainActor
final class FloorPlanEditorViewModel: ObservableObject {
  @Published var isLoading = false
  @Published var errorMessage: String?
  @Published var floorPlan: FloorPlanData
  @Published var tool: FloorPlanEditorTool
  @Published var selectedNodeId: UUID?
  @Published var pendingStartNodeId: UUID?
  @Published var previewEndPoint: CGPoint?
  @Published var scale: CGFloat = 1
  @Published var offset: CGSize = .zero
  @Published var openingType: OpeningType = .door
  @Published var isSaving = false
  @Published var lastSavedAt: Date?

  let grid: FloorPlanGrid
  let theme: FloorPlanCanvasTheme
  let mmPerPoint: CGFloat
  let projectId: UUID?

  private let storage: FloorPlanStorage
  private var saveTask: Task<Void, Never>?
  private var panStartOffset: CGSize?
  private var pinchStartScale: CGFloat?

  init(
    floorPlan: FloorPlanData = .empty,
    tool: FloorPlanEditorTool = .drawWall,
    grid: FloorPlanGrid = FloorPlanDefaults.grid,
    theme: FloorPlanCanvasTheme = FloorPlanDefaults.theme,
    mmPerPoint: CGFloat = 10,
    projectId: UUID? = nil,
    storage: FloorPlanStorage = FloorPlanStorage()
  ) {
    self.floorPlan = floorPlan
    self.tool = tool
    self.grid = grid
    self.theme = theme
    self.mmPerPoint = mmPerPoint
    self.projectId = projectId
    self.storage = storage
  }

  func load() async {
    guard let projectId else { return }
    isLoading = true
    errorMessage = nil
    do {
      if let loaded = try storage.load(projectId: projectId) {
        floorPlan = loaded
      }
    } catch {
      errorMessage = "Failed to load local floor plan."
    }
    isLoading = false
  }

  func point(for node: FloorPlanNode) -> CGPoint {
    CGPoint(x: CGFloat(node.x) / mmPerPoint, y: CGFloat(node.y) / mmPerPoint)
  }

  func worldPoint(from screenPoint: CGPoint) -> CGPoint {
    CGPoint(
      x: (screenPoint.x - offset.width) / max(scale, 0.01),
      y: (screenPoint.y - offset.height) / max(scale, 0.01)
    )
  }

  func mmPoint(from worldPoint: CGPoint) -> (x: Int, y: Int) {
    let rawX = Int((worldPoint.x * mmPerPoint).rounded())
    let rawY = Int((worldPoint.y * mmPerPoint).rounded())
    return (snap(rawX), snap(rawY))
  }

  func snap(_ value: Int) -> Int {
    let step = grid.snapStepMM
    guard step > 0 else { return value }
    return Int((Double(value) / Double(step)).rounded()) * step
  }

  func nearestNode(to worldPoint: CGPoint, threshold: CGFloat = 14) -> FloorPlanNode? {
    let thresholdWorld = threshold / max(scale, 0.01)
    let thresholdSq = thresholdWorld * thresholdWorld
    return floorPlan.nodes.first { node in
      let nodePoint = point(for: node)
      let dx = nodePoint.x - worldPoint.x
      let dy = nodePoint.y - worldPoint.y
      return dx * dx + dy * dy <= thresholdSq
    }
  }

  func addNode(at worldPoint: CGPoint) -> FloorPlanNode {
    let mm = mmPoint(from: worldPoint)
    let node = FloorPlanNode(id: UUID(), x: mm.x, y: mm.y)
    floorPlan.nodes.append(node)
    scheduleSave()
    return node
  }

  func updateNode(_ nodeId: UUID, to worldPoint: CGPoint) {
    let mm = mmPoint(from: worldPoint)
    guard let index = floorPlan.nodes.firstIndex(where: { $0.id == nodeId }) else { return }
    floorPlan.nodes[index].x = mm.x
    floorPlan.nodes[index].y = mm.y
    scheduleSave()
  }

  func addWall(startNodeId: UUID, endNodeId: UUID, thickness: Int = 120) {
    guard startNodeId != endNodeId else { return }
    let wall = FloorPlanWall(id: UUID(), startNodeId: startNodeId, endNodeId: endNodeId, thickness: thickness)
    floorPlan.walls.append(wall)
    scheduleSave()
  }

  func addOpening(to wallId: UUID, offset: Int, width: Int, type: OpeningType) {
    guard let index = floorPlan.walls.firstIndex(where: { $0.id == wallId }) else { return }
    let opening = FloorPlanOpening(id: UUID(), type: type, offset: offset, width: width)
    floorPlan.walls[index].openings.append(opening)
    scheduleSave()
  }

  func handleDragChanged(_ value: DragGesture.Value, in size: CGSize) {
    let worldPoint = worldPoint(from: value.location)
    switch tool {
    case .select:
      if selectedNodeId == nil {
        selectedNodeId = nearestNode(to: worldPoint)?.id
      }
      if let nodeId = selectedNodeId {
        updateNode(nodeId, to: worldPoint)
      }
    case .drawWall:
      if pendingStartNodeId == nil {
        if let existing = nearestNode(to: worldPoint) {
          pendingStartNodeId = existing.id
        } else {
          pendingStartNodeId = addNode(at: worldPoint).id
        }
      }
      previewEndPoint = worldPoint
    case .pan:
      if panStartOffset == nil {
        panStartOffset = offset
      }
      if let panStartOffset {
        offset = CGSize(
          width: panStartOffset.width + value.translation.width,
          height: panStartOffset.height + value.translation.height
        )
      }
    case .opening:
      break
    }
  }

  func handleDragEnded(_ value: DragGesture.Value, in size: CGSize) {
    let worldPoint = worldPoint(from: value.location)
    switch tool {
    case .select:
      selectedNodeId = nil
    case .drawWall:
      guard let startId = pendingStartNodeId else {
        previewEndPoint = nil
        return
      }
      let endNodeId: UUID
      if let existing = nearestNode(to: worldPoint) {
        endNodeId = existing.id
      } else {
        endNodeId = addNode(at: worldPoint).id
      }
      addWall(startNodeId: startId, endNodeId: endNodeId)
      pendingStartNodeId = nil
      previewEndPoint = nil
    case .pan:
      panStartOffset = nil
    case .opening:
      if let hit = nearestWall(to: worldPoint) {
        let wallLength = hit.lengthMM
        let width = openingType == .door ? 900 : 1200
        let halfWidth = width / 2
        let rawOffset = Int(round(hit.t * Double(wallLength)))
        let clampedOffset = min(max(rawOffset, halfWidth), max(halfWidth, wallLength - halfWidth))
        addOpening(to: hit.wall.id, offset: clampedOffset, width: width, type: openingType)
      }
    }
  }

  func handleMagnificationChanged(_ value: CGFloat) {
    if pinchStartScale == nil {
      pinchStartScale = scale
    }
    if let pinchStartScale {
      scale = clampScale(pinchStartScale * value)
    }
  }

  func handleMagnificationEnded() {
    pinchStartScale = nil
  }

  func scheduleSave() {
    guard projectId != nil else { return }
    saveTask?.cancel()
    isSaving = true
    saveTask = Task { [weak self] in
      try? await Task.sleep(nanoseconds: 500_000_000)
      await self?.saveNow()
    }
  }

  private func saveNow() async {
    guard let projectId else { return }
    do {
      try storage.save(floorPlan, projectId: projectId)
      lastSavedAt = Date()
      isSaving = false
    } catch {
      errorMessage = "Failed to save local floor plan."
      isSaving = false
    }
  }

  func draw(in context: GraphicsContext, size: CGSize) {
    var context = context
    context.fill(Path(CGRect(origin: .zero, size: size)), with: .color(theme.background))
    context.translateBy(x: offset.width, y: offset.height)
    context.scaleBy(x: scale, y: scale)
    let worldSize = CGSize(width: size.width / max(scale, 0.01), height: size.height / max(scale, 0.01))
    drawGrid(in: context, size: worldSize)

    for wall in floorPlan.walls {
      guard let start = floorPlan.nodes.first(where: { $0.id == wall.startNodeId }),
            let end = floorPlan.nodes.first(where: { $0.id == wall.endNodeId }) else {
        continue
      }
      let startPoint = point(for: start)
      let endPoint = point(for: end)
      var path = Path()
      path.move(to: startPoint)
      path.addLine(to: endPoint)
      let width = max(1, CGFloat(wall.thickness) / mmPerPoint)
      context.stroke(path, with: .color(theme.wallStroke), lineWidth: width)

      for opening in wall.openings {
        guard let segment = openingSegment(start: start, end: end, opening: opening) else { continue }
        var openingPath = Path()
        openingPath.move(to: segment.start)
        openingPath.addLine(to: segment.end)
        context.stroke(openingPath, with: .color(theme.openingStroke), lineWidth: max(2, width + 2))
      }
    }

    for node in floorPlan.nodes {
      let center = point(for: node)
      let radius: CGFloat = 5
      let rect = CGRect(x: center.x - radius, y: center.y - radius, width: radius * 2, height: radius * 2)
      let color = (node.id == selectedNodeId) ? theme.nodeSelected : theme.nodeFill
      context.fill(Path(ellipseIn: rect), with: .color(color))
    }

    if let startId = pendingStartNodeId, let preview = previewEndPoint,
       let startNode = floorPlan.nodes.first(where: { $0.id == startId }) {
      let startPoint = point(for: startNode)
      var path = Path()
      path.move(to: startPoint)
      path.addLine(to: preview)
      var style = StrokeStyle(lineWidth: 2, lineCap: .round)
      style.dash = [6, 4]
      context.stroke(path, with: .color(theme.previewStroke), style: style)
    }
  }

  private func drawGrid(in context: GraphicsContext, size: CGSize) {
    let minorSpacing = CGFloat(grid.minorStepMM) / mmPerPoint
    let majorSpacing = CGFloat(grid.majorStepMM) / mmPerPoint

    if minorSpacing > 2 {
      var path = Path()
      var x: CGFloat = 0
      while x <= size.width {
        path.move(to: CGPoint(x: x, y: 0))
        path.addLine(to: CGPoint(x: x, y: size.height))
        x += minorSpacing
      }
      var y: CGFloat = 0
      while y <= size.height {
        path.move(to: CGPoint(x: 0, y: y))
        path.addLine(to: CGPoint(x: size.width, y: y))
        y += minorSpacing
      }
      context.stroke(path, with: .color(theme.gridMinor), lineWidth: 0.5)
    }

    if majorSpacing > 2 {
      var path = Path()
      var x: CGFloat = 0
      while x <= size.width {
        path.move(to: CGPoint(x: x, y: 0))
        path.addLine(to: CGPoint(x: x, y: size.height))
        x += majorSpacing
      }
      var y: CGFloat = 0
      while y <= size.height {
        path.move(to: CGPoint(x: 0, y: y))
        path.addLine(to: CGPoint(x: size.width, y: y))
        y += majorSpacing
      }
      context.stroke(path, with: .color(theme.gridMajor), lineWidth: 1)
    }
  }

  private func openingSegment(start: FloorPlanNode, end: FloorPlanNode, opening: FloorPlanOpening) -> (start: CGPoint, end: CGPoint)? {
    let dx = Double(end.x - start.x)
    let dy = Double(end.y - start.y)
    let length = sqrt(dx * dx + dy * dy)
    guard length > 0 else { return nil }
    let ux = dx / length
    let uy = dy / length
    let halfWidth = Double(opening.width) / 2.0
    let center = Double(opening.offset)
    let startOffset = max(0, center - halfWidth)
    let endOffset = min(length, center + halfWidth)

    let startMMX = Double(start.x) + ux * startOffset
    let startMMY = Double(start.y) + uy * startOffset
    let endMMX = Double(start.x) + ux * endOffset
    let endMMY = Double(start.y) + uy * endOffset

    let startPoint = CGPoint(x: startMMX / Double(mmPerPoint), y: startMMY / Double(mmPerPoint))
    let endPoint = CGPoint(x: endMMX / Double(mmPerPoint), y: endMMY / Double(mmPerPoint))
    return (startPoint, endPoint)
  }

  private func nearestWall(to worldPoint: CGPoint, threshold: CGFloat = 12) -> (wall: FloorPlanWall, t: Double, lengthMM: Int)? {
    var best: (FloorPlanWall, Double, Double)?
    for wall in floorPlan.walls {
      guard let start = floorPlan.nodes.first(where: { $0.id == wall.startNodeId }),
            let end = floorPlan.nodes.first(where: { $0.id == wall.endNodeId }) else { continue }
      let startPoint = point(for: start)
      let endPoint = point(for: end)
      let dx = endPoint.x - startPoint.x
      let dy = endPoint.y - startPoint.y
      let lengthSq = dx * dx + dy * dy
      guard lengthSq > 0 else { continue }
      let t = max(0, min(1, ((worldPoint.x - startPoint.x) * dx + (worldPoint.y - startPoint.y) * dy) / lengthSq))
      let projX = startPoint.x + t * dx
      let projY = startPoint.y + t * dy
      let distSq = (projX - worldPoint.x) * (projX - worldPoint.x) + (projY - worldPoint.y) * (projY - worldPoint.y)
      if best == nil || distSq < best!.2 {
        best = (wall, Double(t), Double(distSq))
      }
    }
    guard let best else { return nil }
    let thresholdWorld = threshold / max(scale, 0.01)
    guard sqrt(best.2) <= Double(thresholdWorld) else { return nil }
    guard let start = floorPlan.nodes.first(where: { $0.id == best.0.startNodeId }),
          let end = floorPlan.nodes.first(where: { $0.id == best.0.endNodeId }) else { return nil }
    let lengthMM = Int(hypot(Double(end.x - start.x), Double(end.y - start.y)))
    return (best.0, best.1, lengthMM)
  }

  private func clampScale(_ value: CGFloat) -> CGFloat {
    min(max(value, 0.5), 3.0)
  }
}
