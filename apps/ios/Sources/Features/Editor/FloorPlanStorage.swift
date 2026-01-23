import Foundation

struct FloorPlanStorage {
  enum StorageError: Error {
    case missingDocumentsDirectory
  }

  private let fileManager: FileManager

  init(fileManager: FileManager = .default) {
    self.fileManager = fileManager
  }

  func load(projectId: UUID) throws -> FloorPlanData? {
    let url = try fileURL(projectId: projectId)
    guard fileManager.fileExists(atPath: url.path) else { return nil }
    let data = try Data(contentsOf: url)
    return try JSONDecoder().decode(FloorPlanData.self, from: data)
  }

  func save(_ floorPlan: FloorPlanData, projectId: UUID) throws {
    let url = try fileURL(projectId: projectId)
    let data = try JSONEncoder().encode(floorPlan)
    try data.write(to: url, options: [.atomic])
  }

  private func fileURL(projectId: UUID) throws -> URL {
    guard let dir = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first else {
      throw StorageError.missingDocumentsDirectory
    }
    return dir.appendingPathComponent("floorplan-\(projectId.uuidString).json")
  }
}
