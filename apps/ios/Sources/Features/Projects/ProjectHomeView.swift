import SwiftUI

struct ProjectHomeView: View {
  @StateObject private var viewModel = ProjectHomeViewModel()
  @State private var renameTarget: ProjectSummary?
  @State private var renameValue = ""
  @State private var deleteTarget: ProjectSummary?

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
            .swipeActions(edge: .trailing) {
              Button("Delete", role: .destructive) {
                deleteTarget = project
              }
            }
            .swipeActions(edge: .leading) {
              Button("Rename") {
                renameTarget = project
                renameValue = project.name
              }
              .tint(.blue)
            }
            .contextMenu {
              Button("Rename") {
                renameTarget = project
                renameValue = project.name
              }
              Button("Delete", role: .destructive) {
                deleteTarget = project
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
      .alert("Rename Project", isPresented: Binding(
        get: { renameTarget != nil },
        set: { if !$0 { renameTarget = nil } }
      )) {
        TextField("Project name", text: $renameValue)
        Button("Save") {
          guard let target = renameTarget else { return }
          Task { await viewModel.renameProject(id: target.id, name: renameValue) }
          renameTarget = nil
        }
        Button("Cancel", role: .cancel) {
          renameTarget = nil
        }
      }
      .alert("Delete Project?", isPresented: Binding(
        get: { deleteTarget != nil },
        set: { if !$0 { deleteTarget = nil } }
      ), actions: {
        Button("Delete", role: .destructive) {
          guard let target = deleteTarget else { return }
          Task { await viewModel.deleteProject(id: target.id) }
          deleteTarget = nil
        }
        Button("Cancel", role: .cancel) {
          deleteTarget = nil
        }
      }, message: {
        if let target = deleteTarget {
          Text("This will permanently delete “\(target.name)”.")
        }
      })
    }
  }
}
