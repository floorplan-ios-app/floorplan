import Foundation

struct ProjectSummary: Identifiable, Hashable {
  let id: UUID
  let name: String
  let createdAt: String
  let updatedAt: String
}

private struct ApiProjectRow: Decodable {
  let id: UUID
  let name: String
  let createdAt: String
  let updatedAt: String

  enum CodingKeys: String, CodingKey {
    case id
    case name
    case createdAt = "created_at"
    case updatedAt = "updated_at"
  }
}

private struct ApiListProjectsResponse: Decodable {
  let projects: [ApiProjectRow]
}

private struct ApiProjectResponse: Decodable {
  let project: ApiProjectRow
}

final class ApiClient {
  struct Config {
    let baseURL: URL
    let userId: String
    let actorId: String

    static func `default`() -> Config {
      let baseString = ProcessInfo.processInfo.environment["API_BASE"] ?? "http://localhost:8787"
      return Config(
        baseURL: URL(string: baseString) ?? URL(string: "http://localhost:8787")!,
        userId: ProcessInfo.processInfo.environment["USER_ID"] ?? "demo-user",
        actorId: ProcessInfo.processInfo.environment["ACTOR_ID"] ?? "demo-actor"
      )
    }
  }

  static let shared = ApiClient()

  private let config: Config
  private let decoder: JSONDecoder

  init(config: Config = Config.default()) {
    self.config = config
    self.decoder = JSONDecoder()
  }

  func listProjects() async throws -> [ProjectSummary] {
    var request = URLRequest(url: config.baseURL.appendingPathComponent("/v1/projects"))
    request.httpMethod = "GET"
    request.allHTTPHeaderFields = defaultHeaders()
    let response: ApiListProjectsResponse = try await send(request)
    return response.projects.map { ProjectSummary(id: $0.id, name: $0.name, createdAt: $0.createdAt, updatedAt: $0.updatedAt) }
  }

  func createProject(name: String) async throws -> ProjectSummary {
    var request = URLRequest(url: config.baseURL.appendingPathComponent("/v1/projects"))
    request.httpMethod = "POST"
    request.allHTTPHeaderFields = defaultHeaders()
    let body = ["name": name]
    request.httpBody = try JSONSerialization.data(withJSONObject: body)
    let response: ApiProjectResponse = try await send(request)
    let project = response.project
    return ProjectSummary(id: project.id, name: project.name, createdAt: project.createdAt, updatedAt: project.updatedAt)
  }

  private func send<T: Decodable>(_ request: URLRequest) async throws -> T {
    let (data, response) = try await URLSession.shared.data(for: request)
    guard let http = response as? HTTPURLResponse else {
      throw NSError(domain: "ApiClient", code: -1)
    }
    guard (200..<300).contains(http.statusCode) else {
      let body = String(data: data, encoding: .utf8) ?? ""
      throw NSError(domain: "ApiClient", code: http.statusCode, userInfo: ["body": body])
    }
    return try decoder.decode(T.self, from: data)
  }

  private func defaultHeaders() -> [String: String] {
    [
      "Content-Type": "application/json",
      "x-user-id": config.userId,
      "x-actor-id": config.actorId,
    ]
  }
}
