import { z } from "zod";

export const ApiProjectRow = z.object({
  id: z.string().uuid(),
  name: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  metadata: z.record(z.any()).nullable().optional(),
});

export type ApiProjectRow = z.infer<typeof ApiProjectRow>;

export type ProjectSummary = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown> | null;
};

export const toProjectSummary = (row: ApiProjectRow): ProjectSummary => ({
  id: row.id,
  name: row.name,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  metadata: row.metadata ?? null,
});

export const ApiListProjectsResponse = z.object({
  projects: z.array(ApiProjectRow),
});

export const ApiProjectResponse = z.object({
  project: ApiProjectRow,
});

export const ApiCreateProjectRequest = z.object({
  name: z.string().min(1),
});

export const ApiAppendOpsResponse = z.object({
  accepted: z.number().int().nonnegative(),
  serverSeqMax: z.number().int().nonnegative(),
});

export type ApiAppendOpsResponse = z.infer<typeof ApiAppendOpsResponse>;
