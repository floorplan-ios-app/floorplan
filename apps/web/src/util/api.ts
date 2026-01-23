import {
  ApiAppendOpsResponse,
  ApiDevicesResponse,
  ApiCreateShareRequest,
  ApiCreateProjectRequest,
  ApiListProjectsResponse,
  ApiPairingCompleteResponse,
  ApiPairingCreateResponse,
  ApiProjectResponse,
  ApiShareResponse,
  ProjectSummary,
  toProjectSummary,
} from "@floorplan/shared";
import { Op, OpBatchDownload, OpBatchUpload } from "@floorplan/sync";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8787";

export function getApiHeaders() {
  const userId = import.meta.env.VITE_USER_ID ?? "demo-user";
  const actorId = import.meta.env.VITE_ACTOR_ID ?? "demo-actor";
  return {
    "Content-Type": "application/json",
    "x-user-id": userId,
    "x-actor-id": actorId,
  };
}

async function parseJson<T>(resp: Response, schema: { parse: (data: unknown) => T }): Promise<T> {
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Request failed: ${resp.status} ${resp.statusText} ${text}`.trim());
  }
  const json = await resp.json();
  return schema.parse(json);
}

export async function apiHealth(): Promise<string> {
  const r = await fetch(`${API_BASE}/health`);
  if (!r.ok) throw new Error(`Health check failed: ${r.status}`);
  const j = await r.json();
  return j.status ?? "unknown";
}

export async function apiListProjects(): Promise<ProjectSummary[]> {
  const response = await fetch(`${API_BASE}/v1/projects`, {
    headers: getApiHeaders(),
  });
  const payload = await parseJson(response, ApiListProjectsResponse);
  return payload.projects.map(toProjectSummary);
}

export async function apiCreateProject(name: string): Promise<ProjectSummary> {
  const body = ApiCreateProjectRequest.parse({ name });
  const response = await fetch(`${API_BASE}/v1/projects`, {
    method: "POST",
    headers: getApiHeaders(),
    body: JSON.stringify(body),
  });
  const payload = await parseJson(response, ApiProjectResponse);
  return toProjectSummary(payload.project);
}

export async function apiGetProject(id: string): Promise<ProjectSummary> {
  const response = await fetch(`${API_BASE}/v1/projects/${id}`, {
    headers: getApiHeaders(),
  });
  const payload = await parseJson(response, ApiProjectResponse);
  return toProjectSummary(payload.project);
}

export async function apiAppendOps(projectId: string, ops: Op[]): Promise<ApiAppendOpsResponse> {
  const body = OpBatchUpload.parse({ ops });
  const response = await fetch(`${API_BASE}/v1/projects/${projectId}/ops`, {
    method: "POST",
    headers: getApiHeaders(),
    body: JSON.stringify(body),
  });
  return parseJson(response, ApiAppendOpsResponse);
}

export async function apiGetOps(
  projectId: string,
  afterServerSeq: number,
  limit = 200
): Promise<OpBatchDownload> {
  const url = new URL(`${API_BASE}/v1/projects/${projectId}/ops`);
  url.searchParams.set("afterServerSeq", String(afterServerSeq));
  url.searchParams.set("limit", String(limit));
  const response = await fetch(url.toString(), {
    headers: getApiHeaders(),
  });
  return parseJson(response, OpBatchDownload);
}

export async function apiCreateShare(
  projectId: string,
  mode: "view" | "review"
): Promise<ApiShareResponse["share"]> {
  const body = ApiCreateShareRequest.parse({ mode });
  const response = await fetch(`${API_BASE}/v1/projects/${projectId}/shares`, {
    method: "POST",
    headers: getApiHeaders(),
    body: JSON.stringify(body),
  });
  const payload = await parseJson(response, ApiShareResponse);
  return payload.share;
}

export async function apiCreatePairingCode(options?: {
  deviceName?: string;
  deviceType?: string;
  ttlSeconds?: number;
}): Promise<ApiPairingCreateResponse> {
  const response = await fetch(`${API_BASE}/v1/pairing/create`, {
    method: "POST",
    headers: getApiHeaders(),
    body: JSON.stringify(options ?? {}),
  });
  return parseJson(response, ApiPairingCreateResponse);
}

export async function apiCompletePairing(code: string, options?: { deviceName?: string; deviceType?: string }) {
  const response = await fetch(`${API_BASE}/v1/pairing/complete`, {
    method: "POST",
    headers: getApiHeaders(),
    body: JSON.stringify({ code, ...(options ?? {}) }),
  });
  return parseJson(response, ApiPairingCompleteResponse);
}

export async function apiListDevices() {
  const response = await fetch(`${API_BASE}/v1/devices`, {
    headers: getApiHeaders(),
  });
  return parseJson(response, ApiDevicesResponse);
}

export async function apiRevokeDevice(deviceId: string) {
  const response = await fetch(`${API_BASE}/v1/devices/${deviceId}/revoke`, {
    method: "POST",
    headers: getApiHeaders(),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Request failed: ${response.status} ${response.statusText} ${text}`.trim());
  }
  return true;
}
