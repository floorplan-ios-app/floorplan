import Foundation

/// Network sync client (skeleton).
/// Real implementation should:
/// - use URLSession with retries/backoff
/// - support BGTaskScheduler background sync
/// - upload op batches
/// - download remote ops after server cursor
final class SyncClient {
  let baseURL: URL

  init(baseURL: URL) {
    self.baseURL = baseURL
  }

  func uploadOps(projectId: UUID, actorId: String, ops: [[String: Any]]) async throws -> Int {
    var req = URLRequest(url: baseURL.appendingPathComponent("/v1/projects/\(projectId.uuidString)/ops"))
    req.httpMethod = "POST"
    req.setValue(actorId, forHTTPHeaderField: "x-actor-id")
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.httpBody = try JSONSerialization.data(withJSONObject: ["ops": ops])

    let (data, resp) = try await URLSession.shared.data(for: req)
    guard let http = resp as? HTTPURLResponse, http.statusCode == 200 else {
      throw NSError(domain: "SyncClient", code: 1)
    }
    let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
    return (json?["serverSeqMax"] as? Int) ?? 0
  }

  func downloadOps(projectId: UUID, afterServerSeq: Int) async throws -> ([[String: Any]], Int) {
    var comps = URLComponents(url: baseURL.appendingPathComponent("/v1/projects/\(projectId.uuidString)/ops"), resolvingAgainstBaseURL: false)!
    comps.queryItems = [
      URLQueryItem(name: "afterServerSeq", value: String(afterServerSeq)),
      URLQueryItem(name: "limit", value: "200"),
    ]
    let (data, resp) = try await URLSession.shared.data(from: comps.url!)
    guard let http = resp as? HTTPURLResponse, http.statusCode == 200 else {
      throw NSError(domain: "SyncClient", code: 2)
    }
    let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
    let ops = (json?["ops"] as? [[String: Any]]) ?? []
    let serverSeqMax = (json?["serverSeqMax"] as? Int) ?? afterServerSeq
    return (ops, serverSeqMax)
  }
}
