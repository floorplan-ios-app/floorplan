const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8787";

export async function apiHealth(): Promise<string> {
  const r = await fetch(`${API_BASE}/health`);
  if (!r.ok) throw new Error(`Health check failed: ${r.status}`);
  const j = await r.json();
  return j.status ?? "unknown";
}
