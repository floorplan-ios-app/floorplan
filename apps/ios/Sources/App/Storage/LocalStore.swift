import Foundation

/// Local persistence abstraction (skeleton).
/// Real implementation can use GRDB, Core Data, or SQLite.
/// The spec assumes:
/// - Offline-first project editing
/// - Persistent op-log with monotonic clientSeq per actor per project
/// - Background sync uploading ops and downloading remote ops
protocol LocalStore {
  func loadProject(projectId: UUID) async throws -> Data?
  func saveProject(projectId: UUID, data: Data) async throws

  func appendOps(projectId: UUID, ops: [Data]) async throws
  func loadOps(projectId: UUID, afterClientSeq: Int) async throws -> [Data]

  func getActorId() async throws -> String
}

/// In-memory stub used until persistence is implemented.
final class InMemoryLocalStore: LocalStore {
  private var projects: [UUID: Data] = [:]
  private var ops: [UUID: [Data]] = [:]
  private let actorId: String = UUID().uuidString

  func loadProject(projectId: UUID) async throws -> Data? { projects[projectId] }
  func saveProject(projectId: UUID, data: Data) async throws { projects[projectId] = data }

  func appendOps(projectId: UUID, ops newOps: [Data]) async throws {
    ops[projectId, default: []].append(contentsOf: newOps)
  }

  func loadOps(projectId: UUID, afterClientSeq: Int) async throws -> [Data] {
    // This stub ignores clientSeq and returns everything.
    return ops[projectId, default: []]
  }

  func getActorId() async throws -> String { actorId }
}
