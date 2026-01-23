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
      errorMessage = "Failed to load projects."
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
      errorMessage = "Failed to create project."
    }
    isLoading = false
  }
}
