import Foundation

@MainActor
final class ProjectHomeViewModel: ObservableObject {
  @Published var projects: [ProjectSummary] = []
  @Published var isLoading = false
  @Published var errorMessage: String?
  @Published var newProjectName = ""

  private let apiClient: ApiClient

  init(apiClient: ApiClient = .shared) {
    self.apiClient = apiClient
  }

  func loadProjects() async {
    isLoading = true
    errorMessage = nil
    do {
      let items = try await apiClient.listProjects()
      projects = items
    } catch {
      errorMessage = "Failed to load projects. \(describe(error))"
    }
    isLoading = false
  }

  func createProject() async {
    let trimmed = newProjectName.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return }
    isLoading = true
    errorMessage = nil
    do {
      let project = try await apiClient.createProject(name: trimmed)
      projects.insert(project, at: 0)
      newProjectName = ""
    } catch {
      errorMessage = "Failed to create project. \(describe(error))"
    }
    isLoading = false
  }

  func renameProject(id: UUID, name: String) async {
    let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return }
    isLoading = true
    errorMessage = nil
    do {
      let updated = try await apiClient.renameProject(id: id, name: trimmed)
      if let index = projects.firstIndex(where: { $0.id == id }) {
        projects[index] = updated
      }
    } catch {
      errorMessage = "Failed to rename project. \(describe(error))"
    }
    isLoading = false
  }

  func deleteProject(id: UUID) async {
    isLoading = true
    errorMessage = nil
    do {
      _ = try await apiClient.deleteProject(id: id)
      projects.removeAll { $0.id == id }
    } catch {
      errorMessage = "Failed to delete project. \(describe(error))"
    }
    isLoading = false
  }
}

private func describe(_ error: Error) -> String {
  let nsError = error as NSError
  if let body = nsError.userInfo["body"] as? String, !body.isEmpty {
    return body
  }
  if nsError.domain == NSURLErrorDomain {
    return "\(nsError.localizedDescription) (code \(nsError.code))"
  }
  if !nsError.localizedDescription.isEmpty {
    return nsError.localizedDescription
  }
  return "Unknown error."
}
