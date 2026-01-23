import SwiftUI

struct ProjectHomeView: View {
  @StateObject private var viewModel = ProjectHomeViewModel()

  var body: some View {
    NavigationStack {
      List {
        Section("Create Project") {
          HStack {
            TextField("Project name", text: $viewModel.newProjectName)
              .textInputAutocapitalization(.words)
            Button("Create") {
              Task { await viewModel.createProject() }
            }
            .disabled(viewModel.newProjectName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
          }
        }

        Section("Projects") {
          if viewModel.isLoading {
            HStack {
              ProgressView()
              Text("Loading…")
            }
          }

          if let message = viewModel.errorMessage {
            Text(message)
              .foregroundStyle(.red)
          }

          if viewModel.projects.isEmpty && !viewModel.isLoading {
            Text("No projects yet.")
              .foregroundStyle(.secondary)
          }

          ForEach(viewModel.projects) { project in
            NavigationLink(value: project) {
              VStack(alignment: .leading, spacing: 4) {
                Text(project.name)
                  .font(.headline)
                Text("Updated \(project.updatedAt)")
                  .font(.caption)
                  .foregroundStyle(.secondary)
              }
            }
          }
        }
      }
      .navigationTitle("Projects")
      .navigationDestination(for: ProjectSummary.self) { project in
        EditorView(project: project)
      }
      .toolbar {
        Button("Refresh") {
          Task { await viewModel.loadProjects() }
        }
      }
      .task {
        await viewModel.loadProjects()
      }
    }
  }
}
