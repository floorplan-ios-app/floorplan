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

struct PairingCodeResponse: Hashable {
  let pairingId: UUID
  let code: String
  let expiresAt: String
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

private struct ApiProjectUpdateResponse: Decodable {
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

private struct ApiAuthSessionResponse: Decodable {
  let accessToken: String
  let refreshToken: String
  let accessExpiresAt: String
  let refreshExpiresAt: String
  let userId: String?
}

private struct ApiAuthRefreshResponse: Decodable {
  let accessToken: String
  let refreshToken: String
  let accessExpiresAt: String
  let refreshExpiresAt: String
}

private struct AuthState: Codable {
  let userId: String
  let actorId: String
  let accessToken: String
  let refreshToken: String
  let accessExpiresAt: String
  let refreshExpiresAt: String
}

final class ApiClient {
  struct Config {
    let baseURL: URL
    let userId: String
    let actorId: String

    static func `default`() -> Config {
      let baseString = ProcessInfo.processInfo.environment["API_BASE"] ?? "http://127.0.0.1:8787"
      let identity = DeviceIdentity.load()
      return Config(
        baseURL: URL(string: baseString) ?? URL(string: "http://127.0.0.1:8787")!,
        userId: ProcessInfo.processInfo.environment["USER_ID"] ?? identity.userId,
        actorId: ProcessInfo.processInfo.environment["ACTOR_ID"] ?? identity.actorId
      )
    }
  }

  static let shared = ApiClient()

  private let config: Config
  private let decoder: JSONDecoder
  private let authKey = "fp.auth.state"
  private let authConfigKey = "fp.auth.config"
  private var cachedAuthState: AuthState?
  private var authTask: Task<AuthState, Error>?
  private let authLock = NSLock()
  private let configVersion = 2

  init(config: Config = Config.default()) {
    self.config = config
    self.decoder = JSONDecoder()
  }

  var baseURLString: String {
    config.baseURL.absoluteString
  }

  var deviceIdString: String {
    config.actorId
  }

  func listProjects() async throws -> [ProjectSummary] {
    let auth = try await ensureAuthState()
    var request = URLRequest(url: config.baseURL.appendingPathComponent("/v1/projects"))
    request.httpMethod = "GET"
    request.allHTTPHeaderFields = headers(for: auth)
    let response: ApiListProjectsResponse = try await send(request)
    return response.projects.map { ProjectSummary(id: $0.id, name: $0.name, createdAt: $0.createdAt, updatedAt: $0.updatedAt) }
  }

  func createProject(name: String) async throws -> ProjectSummary {
    let auth = try await ensureAuthState()
    var request = URLRequest(url: config.baseURL.appendingPathComponent("/v1/projects"))
    request.httpMethod = "POST"
    request.allHTTPHeaderFields = headers(for: auth)
    let body = ["name": name]
    request.httpBody = try JSONSerialization.data(withJSONObject: body)
    let response: ApiProjectResponse = try await send(request)
    let project = response.project
    return ProjectSummary(id: project.id, name: project.name, createdAt: project.createdAt, updatedAt: project.updatedAt)
  }

  func renameProject(id: UUID, name: String) async throws -> ProjectSummary {
    let auth = try await ensureAuthState()
    var request = URLRequest(url: config.baseURL.appendingPathComponent("/v1/projects/\(id.uuidString)"))
    request.httpMethod = "PATCH"
    request.allHTTPHeaderFields = headers(for: auth)
    request.httpBody = try JSONSerialization.data(withJSONObject: ["name": name])
    let response: ApiProjectUpdateResponse = try await send(request)
    let project = response.project
    return ProjectSummary(id: project.id, name: project.name, createdAt: project.createdAt, updatedAt: project.updatedAt)
  }

  func deleteProject(id: UUID) async throws -> Bool {
    let auth = try await ensureAuthState()
    var request = URLRequest(url: config.baseURL.appendingPathComponent("/v1/projects/\(id.uuidString)"))
    request.httpMethod = "DELETE"
    request.allHTTPHeaderFields = headers(for: auth)
    _ = try await sendRaw(request)
    return true
  }

  func createPairingCode(deviceName: String?, deviceType: String?) async throws -> PairingCodeResponse {
    let auth = try await ensureAuthState()
    var request = URLRequest(url: config.baseURL.appendingPathComponent("/v1/pairing/create"))
    request.httpMethod = "POST"
    request.allHTTPHeaderFields = headers(for: auth)
    var body: [String: Any] = [:]
    if let deviceName { body["deviceName"] = deviceName }
    if let deviceType { body["deviceType"] = deviceType }
    request.httpBody = try JSONSerialization.data(withJSONObject: body)
    let response: ApiPairingCreateResponse = try await send(request)
    return PairingCodeResponse(pairingId: response.pairingId, code: response.code, expiresAt: response.expiresAt)
  }

  func listDevices() async throws -> [DeviceSummary] {
    let auth = try await ensureAuthState()
    var request = URLRequest(url: config.baseURL.appendingPathComponent("/v1/devices"))
    request.httpMethod = "GET"
    request.allHTTPHeaderFields = headers(for: auth)
    let response: ApiDevicesResponse = try await send(request)
    return response.devices.map {
      DeviceSummary(id: $0.id, name: $0.name, deviceType: $0.deviceType, revokedAt: $0.revokedAt)
    }
  }

  func revokeDevice(deviceId: UUID) async throws -> Bool {
    let auth = try await ensureAuthState()
    var request = URLRequest(url: config.baseURL.appendingPathComponent("/v1/devices/\(deviceId.uuidString)/revoke"))
    request.httpMethod = "POST"
    request.allHTTPHeaderFields = headers(for: auth)
    _ = try await sendRaw(request)
    return true
  }

  private func send<T: Decodable>(_ request: URLRequest) async throws -> T {
    do {
      let (data, response) = try await URLSession.shared.data(for: withTimeout(request))
      guard let http = response as? HTTPURLResponse else {
        throw NSError(domain: "ApiClient", code: -1)
      }
      guard (200..<300).contains(http.statusCode) else {
        let body = String(data: data, encoding: .utf8) ?? ""
        throw NSError(domain: "ApiClient", code: http.statusCode, userInfo: ["body": body])
      }
      return try decoder.decode(T.self, from: data)
    } catch {
      if let url = request.url?.absoluteString {
        print("ApiClient request failed: \(request.httpMethod ?? "GET") \(url) \(error)")
      }
      throw error
    }
  }

  private func sendRaw(_ request: URLRequest) async throws -> Data {
    let (data, response) = try await URLSession.shared.data(for: withTimeout(request))
    guard let http = response as? HTTPURLResponse else {
      throw NSError(domain: "ApiClient", code: -1)
    }
    guard (200..<300).contains(http.statusCode) else {
      let body = String(data: data, encoding: .utf8) ?? ""
      throw NSError(domain: "ApiClient", code: http.statusCode, userInfo: ["body": body])
    }
    return data
  }

  private func headers(for auth: AuthState) -> [String: String] {
    [
      "Content-Type": "application/json",
      "Authorization": "Bearer \(auth.accessToken)",
      "x-actor-id": auth.actorId,
    ]
  }

  private func ensureAuthState() async throws -> AuthState {
    let existingTask: Task<AuthState, Error>? = authLock.withLock { authTask }
    if let existingTask {
      return try await existingTask.value
    }

    let task = Task { [weak self] () throws -> AuthState in
      guard let self else {
        throw NSError(domain: "ApiClient", code: -2)
      }
      defer {
        self.authLock.withLock { self.authTask = nil }
      }
      let configSignature = self.currentConfigSignature()
      if self.cachedConfigSignature() != configSignature {
        self.clearAuthState()
        self.storeConfigSignature(configSignature)
      }
      let current = self.authLock.withLock { self.cachedAuthState ?? self.loadAuthState() }
      if let current {
        if current.userId != self.config.userId || current.actorId != self.config.actorId {
          self.clearAuthState()
        } else {
        self.authLock.withLock { self.cachedAuthState = current }
        if !self.isExpired(current.accessExpiresAt) {
          return current
        }
        if !self.isExpired(current.refreshExpiresAt) {
          let refreshed = try await self.refreshSession(with: current)
          self.cacheAuthState(refreshed)
          return refreshed
        }
        self.clearAuthState()
        }
      }

      let userId = self.config.userId.isEmpty ? UUID().uuidString : self.config.userId
      let actorId = self.config.actorId.isEmpty ? UUID().uuidString : self.config.actorId
      let created = try await self.createSession(userId: userId, actorId: actorId, deviceId: actorId)
      self.cacheAuthState(created)
      return created
    }

    authLock.withLock { authTask = task }
    return try await task.value
  }

  private func createSession(userId: String, actorId: String, deviceId: String?) async throws -> AuthState {
    var request = URLRequest(url: config.baseURL.appendingPathComponent("/v1/auth/session"))
    request.httpMethod = "POST"
    request.allHTTPHeaderFields = ["Content-Type": "application/json", "x-actor-id": actorId]
    var payload: [String: Any] = ["userId": userId]
    if let deviceId { payload["deviceId"] = deviceId }
    request.httpBody = try JSONSerialization.data(withJSONObject: payload)
    let response: ApiAuthSessionResponse = try await send(request)
    return AuthState(
      userId: response.userId ?? userId,
      actorId: actorId,
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      accessExpiresAt: response.accessExpiresAt,
      refreshExpiresAt: response.refreshExpiresAt
    )
  }

  private func refreshSession(with state: AuthState) async throws -> AuthState {
    var request = URLRequest(url: config.baseURL.appendingPathComponent("/v1/auth/refresh"))
    request.httpMethod = "POST"
    request.allHTTPHeaderFields = ["Content-Type": "application/json", "x-actor-id": state.actorId]
    request.httpBody = try JSONSerialization.data(withJSONObject: ["refreshToken": state.refreshToken])
    let response: ApiAuthRefreshResponse = try await send(request)
    return AuthState(
      userId: state.userId,
      actorId: state.actorId,
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      accessExpiresAt: response.accessExpiresAt,
      refreshExpiresAt: response.refreshExpiresAt
    )
  }

  private func cacheAuthState(_ state: AuthState) {
    authLock.withLock { cachedAuthState = state }
    if let data = try? JSONEncoder().encode(state) {
      UserDefaults.standard.set(data, forKey: authKey)
    }
  }

  private func loadAuthState() -> AuthState? {
    guard let data = UserDefaults.standard.data(forKey: authKey) else { return nil }
    return try? JSONDecoder().decode(AuthState.self, from: data)
  }

  private func isExpired(_ isoString: String) -> Bool {
    let formatter = ISO8601DateFormatter()
    guard let date = formatter.date(from: isoString) else { return true }
    return date <= Date()
  }

  private func clearAuthState() {
    authLock.withLock {
      cachedAuthState = nil
      authTask = nil
    }
    UserDefaults.standard.removeObject(forKey: authKey)
  }

  private func currentConfigSignature() -> String {
    "\(configVersion)|\(config.userId)|\(config.actorId)|\(config.baseURL.absoluteString)"
  }

  private func cachedConfigSignature() -> String? {
    UserDefaults.standard.string(forKey: authConfigKey)
  }

  private func storeConfigSignature(_ signature: String) {
    UserDefaults.standard.set(signature, forKey: authConfigKey)
  }

  private func withTimeout(_ request: URLRequest) -> URLRequest {
    var copy = request
    if copy.timeoutInterval == 0 {
      copy.timeoutInterval = 12
    }
    return copy
  }
}

private extension NSLock {
  func withLock<T>(_ body: () -> T) -> T {
    lock()
    defer { unlock() }
    return body()
  }
}
