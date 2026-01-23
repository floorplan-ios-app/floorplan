import Foundation

struct ProjectSummary: Identifiable, Hashable {
  let id: UUID
  let name: String
  let createdAt: String
  let updatedAt: String
}

struct DeviceSummary: Hashable {
  let id: UUID
  let name: String?
  let deviceType: String?
  let revokedAt: String?
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

private struct ApiDeviceRow: Decodable {
  let id: UUID
  let name: String?
  let deviceType: String?
  let revokedAt: String?

  enum CodingKeys: String, CodingKey {
    case id
    case name
    case deviceType = "device_type"
    case revokedAt = "revoked_at"
  }
}

private struct ApiDevicesResponse: Decodable {
  let devices: [ApiDeviceRow]
}

private struct ApiPairingCreateResponse: Decodable {
  let pairingId: UUID
  let code: String
  let expiresAt: String

  enum CodingKeys: String, CodingKey {
    case pairingId
    case code
    case expiresAt
  }
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

  func createPairingCode(deviceName: String?, deviceType: String?) async throws -> ApiPairingCreateResponse {
    var request = URLRequest(url: config.baseURL.appendingPathComponent("/v1/pairing/create"))
    request.httpMethod = "POST"
    request.allHTTPHeaderFields = defaultHeaders()
    var body: [String: Any] = [:]
    if let deviceName { body["deviceName"] = deviceName }
    if let deviceType { body["deviceType"] = deviceType }
    request.httpBody = try JSONSerialization.data(withJSONObject: body)
    return try await send(request)
  }

  func listDevices() async throws -> [DeviceSummary] {
    var request = URLRequest(url: config.baseURL.appendingPathComponent("/v1/devices"))
    request.httpMethod = "GET"
    request.allHTTPHeaderFields = defaultHeaders()
    let response: ApiDevicesResponse = try await send(request)
    return response.devices.map {
      DeviceSummary(id: $0.id, name: $0.name, deviceType: $0.deviceType, revokedAt: $0.revokedAt)
    }
  }

  func revokeDevice(deviceId: UUID) async throws -> Bool {
    var request = URLRequest(url: config.baseURL.appendingPathComponent("/v1/devices/\(deviceId.uuidString)/revoke"))
    request.httpMethod = "POST"
    request.allHTTPHeaderFields = defaultHeaders()
    _ = try await sendRaw(request)
    return true
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

  private func sendRaw(_ request: URLRequest) async throws -> Data {
    let (data, response) = try await URLSession.shared.data(for: request)
    guard let http = response as? HTTPURLResponse else {
      throw NSError(domain: "ApiClient", code: -1)
    }
    guard (200..<300).contains(http.statusCode) else {
      let body = String(data: data, encoding: .utf8) ?? ""
      throw NSError(domain: "ApiClient", code: http.statusCode, userInfo: ["body": body])
    }
    return data
  }

  private func defaultHeaders() -> [String: String] {
    [
      "Content-Type": "application/json",
      "x-user-id": config.userId,
      "x-actor-id": config.actorId,
    ]
  }
}
