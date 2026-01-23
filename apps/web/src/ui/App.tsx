import React, { useEffect, useMemo, useState } from "react";
import type { ProjectSummary } from "@floorplan/shared";
import {
  apiCreateProject,
  apiCreateShare,
  apiGetProject,
  apiHealth,
  apiListProjects,
  getApiHeaders,
} from "../util/api";
import { createRealtimeClient, RealtimeEvent } from "../util/realtime";

const formatTimestamp = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString();
};

const useAuthStub = () => {
  const userId = import.meta.env.VITE_USER_ID ?? "demo-user";
  const actorId = import.meta.env.VITE_ACTOR_ID ?? "demo-actor";
  return { userId, actorId };
};

type ShareState = {
  token: string;
  link: string;
  mode: "view" | "review";
};

export function App() {
  const { userId, actorId } = useAuthStub();
  const [health, setHealth] = useState<string>("(loading)");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectSummary | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [createName, setCreateName] = useState("");
  const [shareState, setShareState] = useState<ShareState | null>(null);
  const [activityLog, setActivityLog] = useState<string[]>([]);
  const [realtimeStatus, setRealtimeStatus] = useState("idle");

  const apiBase = import.meta.env.VITE_API_BASE ?? "http://localhost:8787";

  useEffect(() => {
    apiHealth().then(setHealth).catch((e) => setHealth(String(e)));
  }, []);

  const refreshProjects = async (options?: {
    onSettled?: () => void;
    skipAutoSelect?: boolean;
    shouldCancel?: () => boolean;
  }) => {
    setLoadingProjects(true);
    setProjectError(null);
    try {
      const items = await apiListProjects();
      if (options?.shouldCancel?.()) return;
      setProjects(items);
      if (items.length && !selectedProject && !options?.skipAutoSelect) {
        setSelectedProject(items[0]);
      }
    } catch (e) {
      if (options?.shouldCancel?.()) return;
      setProjectError(String(e));
    } finally {
      if (options?.shouldCancel?.()) return;
      setLoadingProjects(false);
      options?.onSettled?.();
    }
  };

  useEffect(() => {
    let cancelled = false;
    void refreshProjects({
      shouldCancel: () => cancelled,
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedProject) return;
    const client = createRealtimeClient({
      apiBase,
      projectId: selectedProject.id,
      headers: getApiHeaders(),
      onEvent: (event: RealtimeEvent) => {
        if (event.type === "status") {
          setRealtimeStatus(event.status);
          setActivityLog((prev) => [
            `${new Date().toLocaleTimeString()} · realtime ${event.status}`,
            ...prev,
          ]);
        }
        if (event.type === "ops") {
          setActivityLog((prev) => [
            `${new Date().toLocaleTimeString()} · received ${event.payload.ops.length} ops`,
            ...prev,
          ]);
        }
      },
    });
    return () => client.close();
  }, [apiBase, selectedProject]);

  const onCreateProject = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!createName.trim()) return;
    setProjectError(null);
    try {
      const created = await apiCreateProject(createName.trim());
      setProjects((prev) => [created, ...prev]);
      setSelectedProject(created);
      setCreateName("");
    } catch (e) {
      setProjectError(String(e));
    }
  };

  const onSelectProject = async (projectId: string) => {
    setProjectError(null);
    try {
      const project = await apiGetProject(projectId);
      setSelectedProject(project);
    } catch (e) {
      setProjectError(String(e));
    }
  };

  const onShare = async (mode: "view" | "review") => {
    if (!selectedProject) return;
    setProjectError(null);
    try {
      const share = await apiCreateShare(selectedProject.id, mode);
      const link = `${window.location.origin}/share/${share.token}`;
      setShareState({ token: share.token, link, mode: share.mode });
    } catch (e) {
      setProjectError(String(e));
    }
  };

  const onCopyShare = async () => {
    if (!shareState) return;
    await navigator.clipboard.writeText(shareState.link).catch(() => undefined);
    setActivityLog((prev) => [
      `${new Date().toLocaleTimeString()} · copied share link (${shareState.mode})`,
      ...prev,
    ]);
  };

  const selectedMeta = useMemo(() => {
    if (!selectedProject) return null;
    return {
      ...selectedProject,
      metadata: selectedProject.metadata ?? {},
    };
  }, [selectedProject]);

  return (
    <div style={{ fontFamily: "system-ui", padding: 24, display: "grid", gap: 24 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0 }}>Floor Plan Tracer</h1>
          <p style={{ margin: "4px 0 0" }}>Authenticated Projects + Share/Review Console</p>
        </div>
        <div style={{ textAlign: "right", fontSize: 14 }}>
          <div>API health: {health}</div>
          <div>User: {userId}</div>
          <div>Actor: {actorId}</div>
        </div>
      </header>

      <main style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 24 }}>
        <section style={{ border: "1px solid #ddd", padding: 16, borderRadius: 12 }}>
          <h2 style={{ marginTop: 0 }}>Projects</h2>
          <form onSubmit={onCreateProject} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input
              type="text"
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
              placeholder="New project name"
              style={{ flex: 1, padding: "6px 8px" }}
            />
            <button type="submit">Create</button>
          </form>
          <button onClick={refreshProjects} disabled={loadingProjects}>
            {loadingProjects ? "Refreshing…" : "Refresh"}
          </button>
          {projectError && (
            <p style={{ color: "crimson" }}>{projectError}</p>
          )}
          <ul style={{ listStyle: "none", padding: 0, marginTop: 12 }}>
            {projects.map((project) => (
              <li key={project.id} style={{ marginBottom: 8 }}>
                <button
                  onClick={() => onSelectProject(project.id)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: 8,
                    borderRadius: 8,
                    border: "1px solid #eee",
                    background: selectedProject?.id === project.id ? "#f0f4ff" : "#fff",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{project.name}</div>
                  <div style={{ fontSize: 12, color: "#666" }}>
                    Updated {formatTimestamp(project.updatedAt)}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section style={{ display: "grid", gap: 16 }}>
          <div style={{ border: "1px solid #ddd", padding: 16, borderRadius: 12 }}>
            <h2 style={{ marginTop: 0 }}>Project Viewer</h2>
            {selectedProject ? (
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{selectedProject.name}</div>
                <div>ID: {selectedProject.id}</div>
                <div>Created: {formatTimestamp(selectedProject.createdAt)}</div>
                <div>Updated: {formatTimestamp(selectedProject.updatedAt)}</div>
                <div>Realtime: {realtimeStatus}</div>
              </div>
            ) : (
              <p>Select a project to preview details.</p>
            )}
          </div>

          <div style={{ border: "1px solid #ddd", padding: 16, borderRadius: 12 }}>
            <h2 style={{ marginTop: 0 }}>Share & Review</h2>
            <p style={{ marginTop: 0 }}>
              Generate view-only or review links aligned with backend share token expectations.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => onShare("view")} disabled={!selectedProject}>
                Create view link
              </button>
              <button onClick={() => onShare("review")} disabled={!selectedProject}>
                Create review link
              </button>
              <button onClick={onCopyShare} disabled={!shareState}>
                Copy link
              </button>
            </div>
            {shareState && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, color: "#666" }}>Share token: {shareState.token}</div>
                <a href={shareState.link} target="_blank" rel="noreferrer">
                  {shareState.link}
                </a>
              </div>
            )}
          </div>

          <div style={{ border: "1px solid #ddd", padding: 16, borderRadius: 12 }}>
            <h2 style={{ marginTop: 0 }}>Review Workspace</h2>
            {selectedMeta ? (
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ fontWeight: 600 }}>Metadata snapshot</div>
                <pre style={{ margin: 0, background: "#fafafa", padding: 12, borderRadius: 8 }}>
                  {JSON.stringify(selectedMeta.metadata, null, 2)}
                </pre>
                <div style={{ fontSize: 12, color: "#666" }}>
                  Use this panel to align with server review queues and comments later.
                </div>
              </div>
            ) : (
              <p>Choose a project to inspect share-ready metadata.</p>
            )}
          </div>
        </section>
      </main>

      <aside style={{ border: "1px solid #ddd", padding: 16, borderRadius: 12 }}>
        <h2 style={{ marginTop: 0 }}>Realtime Activity</h2>
        <p style={{ marginTop: 0, color: "#666" }}>
          Polling fallback active when websocket unavailable.
        </p>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {activityLog.slice(0, 6).map((entry, index) => (
            <li key={`${entry}-${index}`} style={{ fontSize: 12, marginBottom: 4 }}>
              {entry}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
