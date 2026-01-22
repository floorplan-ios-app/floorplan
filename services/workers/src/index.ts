import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { AssetJob, AssetVariantType } from "@floorplan/shared";

type AssetJobRow = {
  id: string;
  payload: AssetJob;
};

type AssetVariantInsert = {
  projectId: string;
  assetId: string;
  variantType: AssetVariantType;
  objectKey: string;
  sha256: string;
  pipelineVersion: string;
  metadata?: Record<string, unknown>;
};

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("Missing required env var: DATABASE_URL");
}

const POLL_INTERVAL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 2000);
const BATCH_SIZE = Number(process.env.WORKER_BATCH_SIZE ?? 5);

const sql = postgres(DATABASE_URL, {
  max: Number(process.env.PG_POOL_MAX ?? 5),
  idle_timeout: 20,
});

const buildVariantKey = (variantType: AssetVariantType, sha256: string, metadata?: any) => {
  switch (variantType) {
    case "canonical":
      return `assets/norm/${sha256}/canonical.glb`;
    case "web.meshopt":
      return `assets/variants/${sha256}/web/meshopt.glb`;
    case "web.draco":
      return `assets/variants/${sha256}/web/draco.glb`;
    case "web.texture":
      return `assets/variants/${sha256}/web/textures/${metadata?.tier ?? "default"}.ktx2`;
    case "ios.usdz":
      return `assets/variants/${sha256}/ios/model.usdz`;
    case "thumb":
      return `assets/thumbs/${sha256}/thumb.png`;
    case "preview":
      return `assets/previews/${sha256}/hero.jpg`;
    case "turntable":
      return `assets/turntables/${sha256}/turntable.mp4`;
    case "source":
    default:
      return `assets/src/${sha256}/source`;
  }
};

const claimJobs = async (limit: number) =>
  sql.begin(async (tx) => {
    const rows = await tx<{ id: string }[]>`
      SELECT id
      FROM asset_jobs
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    `;
    if (!rows.length) return [];
    const ids = rows.map((row) => row.id);
    const updated = await tx<AssetJobRow[]>`
      UPDATE asset_jobs
      SET status = 'processing',
          started_at = now(),
          updated_at = now(),
          attempts = attempts + 1
      WHERE id IN ${tx(ids)}
      RETURNING id, payload
    `;
    return updated;
  });

const updateJobStatus = async (jobId: string, status: "completed" | "failed", error?: string) => {
  await sql`
    UPDATE asset_jobs
    SET status = ${status},
        updated_at = now(),
        finished_at = now(),
        last_error = ${error ?? null}
    WHERE id = ${jobId}::uuid
  `;
};

const insertVariants = async (variants: AssetVariantInsert[]) => {
  for (const variant of variants) {
    await sql`
      INSERT INTO asset_variants (
        id,
        project_id,
        asset_id,
        variant_type,
        object_key,
        sha256,
        pipeline_version,
        metadata
      )
      VALUES (
        ${randomUUID()}::uuid,
        ${variant.projectId}::uuid,
        ${variant.assetId}::uuid,
        ${variant.variantType},
        ${variant.objectKey},
        ${variant.sha256},
        ${variant.pipelineVersion},
        ${sql.json(variant.metadata ?? {})}
      )
      ON CONFLICT DO NOTHING
    `;
  }
};

const buildVariantsForJob = (job: AssetJob): AssetVariantInsert[] => {
  const base = {
    projectId: job.projectId,
    assetId: job.assetId,
    sha256: job.sourceSha256,
    pipelineVersion: job.pipelineVersion,
  };
  switch (job.type) {
    case "asset.normalize":
      return [
        {
          ...base,
          variantType: "canonical",
          objectKey: buildVariantKey("canonical", job.sourceSha256),
        },
      ];
    case "asset.optimize": {
      const variants: AssetVariantInsert[] = [];
      if (job.payload.meshopt) {
        variants.push({
          ...base,
          variantType: "web.meshopt",
          objectKey: buildVariantKey("web.meshopt", job.sourceSha256),
        });
      }
      if (job.payload.draco) {
        variants.push({
          ...base,
          variantType: "web.draco",
          objectKey: buildVariantKey("web.draco", job.sourceSha256),
        });
      }
      for (const tier of job.payload.textureTiers) {
        variants.push({
          ...base,
          variantType: "web.texture",
          objectKey: buildVariantKey("web.texture", job.sourceSha256, { tier }),
          metadata: { tier },
        });
      }
      return variants;
    }
    case "asset.convert":
      return [
        {
          ...base,
          variantType: job.payload.target === "ios" ? "ios.usdz" : "web.meshopt",
          objectKey: buildVariantKey(
            job.payload.target === "ios" ? "ios.usdz" : "web.meshopt",
            job.sourceSha256
          ),
          metadata: { target: job.payload.target },
        },
      ];
    case "asset.render":
      return [
        {
          ...base,
          variantType: "thumb",
          objectKey: buildVariantKey("thumb", job.sourceSha256),
          metadata: { size: job.payload.thumbnailSize },
        },
        ...(job.payload.hero
          ? [
              {
                ...base,
                variantType: "preview",
                objectKey: buildVariantKey("preview", job.sourceSha256),
                metadata: { hero: job.payload.hero },
              },
            ]
          : []),
        ...(job.payload.turntable
          ? [
              {
                ...base,
                variantType: "turntable",
                objectKey: buildVariantKey("turntable", job.sourceSha256),
                metadata: { turntable: true },
              },
            ]
          : []),
      ];
    default:
      return [];
  }
};

const processJob = async (row: AssetJobRow) => {
  const parsed = AssetJob.safeParse(row.payload);
  if (!parsed.success) {
    await updateJobStatus(row.id, "failed", "invalid job payload");
    return;
  }
  try {
    const variants = buildVariantsForJob(parsed.data);
    await insertVariants(variants);
    await updateJobStatus(row.id, "completed");
  } catch (error) {
    console.error("job failed", row.id, error);
    await updateJobStatus(row.id, "failed", error instanceof Error ? error.message : "unknown error");
  }
};

const pollOnce = async () => {
  const jobs = await claimJobs(BATCH_SIZE);
  for (const job of jobs) {
    await processJob(job);
  }
};

let running = false;
const pollLoop = async () => {
  if (running) return;
  running = true;
  try {
    await pollOnce();
  } finally {
    running = false;
  }
};

console.log("workers online: asset pipeline queue polling");
await pollOnce();
setInterval(() => {
  void pollLoop();
}, POLL_INTERVAL_MS);
