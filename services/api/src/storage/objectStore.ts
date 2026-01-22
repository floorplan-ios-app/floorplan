import { randomUUID } from "node:crypto";

export type PresignedRequest = {
  url: string;
  method: "PUT" | "GET";
  headers: Record<string, string>;
  objectKey: string;
  expiresAt: string;
};

export type ObjectStore = {
  buildObjectKey(args: { prefix: string; filename?: string | null; contentType?: string | null }): string;
  createPresignedUpload(args: { objectKey: string; contentType?: string | null }): PresignedRequest;
  createPresignedDownload(args: { objectKey: string }): PresignedRequest;
};

function sanitizeFilename(filename: string | null | undefined): string {
  if (!filename) return "file";
  return filename.replace(/[^a-zA-Z0-9._-]/g, "-");
}

export function createLocalObjectStore(): ObjectStore {
  const baseUrl = process.env.OBJECT_STORE_PUBLIC_BASE_URL ?? "http://localhost:9000/floorplan";
  return {
    buildObjectKey({ prefix, filename }) {
      const safeName = sanitizeFilename(filename);
      return `${prefix}/${randomUUID()}-${safeName}`;
    },
    createPresignedUpload({ objectKey, contentType }) {
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      const headers: Record<string, string> = {};
      if (contentType) {
        headers["Content-Type"] = contentType;
      }
      return {
        url: `${baseUrl}/${objectKey}`,
        method: "PUT",
        headers,
        objectKey,
        expiresAt,
      };
    },
    createPresignedDownload({ objectKey }) {
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      return {
        url: `${baseUrl}/${objectKey}`,
        method: "GET",
        headers: {},
        objectKey,
        expiresAt,
      };
    },
  };
}
