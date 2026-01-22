import { z } from "zod";

export const AssetPipelineVersion = "2026-01-22.1";

export const AssetVariantType = z.enum([
  "source",
  "canonical",
  "web.meshopt",
  "web.draco",
  "web.texture",
  "ios.usdz",
  "thumb",
  "preview",
]);

export type AssetVariantType = z.infer<typeof AssetVariantType>;

export const AssetJobRequestBase = z.object({
  sourceSha256: z.string().min(1),
  pipelineVersion: z.string().min(1).default(AssetPipelineVersion),
  requestedBy: z.string().optional(),
});

export const AssetJobBase = AssetJobRequestBase.extend({
  projectId: z.string().uuid(),
  assetId: z.string().uuid(),
});

export const AssetNormalizePayload = z.object({
  normalizeUnits: z.boolean().default(true),
  normalizeOrientation: z.boolean().default(true),
});

export const AssetOptimizePayload = z.object({
  meshopt: z.boolean().default(true),
  draco: z.boolean().default(false),
  textureTiers: z.array(z.string()).default(["1k", "2k", "4k"]),
});

export const AssetConvertPayload = z.object({
  target: z.enum(["ios", "web"]),
});

export const AssetRenderPayload = z.object({
  thumbnailSize: z.number().int().positive().default(512),
  hero: z.boolean().default(true),
  turntable: z.boolean().default(false),
});

export const AssetJobRequest = z.discriminatedUnion("type", [
  AssetJobRequestBase.extend({
    type: z.literal("asset.normalize"),
    payload: AssetNormalizePayload,
  }),
  AssetJobRequestBase.extend({
    type: z.literal("asset.optimize"),
    payload: AssetOptimizePayload,
  }),
  AssetJobRequestBase.extend({
    type: z.literal("asset.convert"),
    payload: AssetConvertPayload,
  }),
  AssetJobRequestBase.extend({
    type: z.literal("asset.render"),
    payload: AssetRenderPayload,
  }),
]);

export const AssetJob = z.discriminatedUnion("type", [
  AssetJobBase.extend({
    type: z.literal("asset.normalize"),
    payload: AssetNormalizePayload,
  }),
  AssetJobBase.extend({
    type: z.literal("asset.optimize"),
    payload: AssetOptimizePayload,
  }),
  AssetJobBase.extend({
    type: z.literal("asset.convert"),
    payload: AssetConvertPayload,
  }),
  AssetJobBase.extend({
    type: z.literal("asset.render"),
    payload: AssetRenderPayload,
  }),
]);

export type AssetJobRequest = z.infer<typeof AssetJobRequest>;
export type AssetJob = z.infer<typeof AssetJob>;

export const AssetJobStatus = z.enum(["pending", "processing", "completed", "failed"]);
export type AssetJobStatus = z.infer<typeof AssetJobStatus>;
