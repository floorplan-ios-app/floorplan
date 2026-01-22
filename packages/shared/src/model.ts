import { z } from "zod";

/**
 * Core domain model (scaffold).
 * Kept intentionally small; expand according to docs/specs.
 */

// SPEC: docs/specs/OVERARCHING_ARCHITECTURE_SPEC.md#core-data-model
export const CURRENT_SCHEMA_VERSION = 1;
export const SchemaVersion = z.number().int().min(1);
export const NonEmptyString = z.string().min(1);
export const IsoDateTime = z.string().datetime();

export const IntMM = z.number().int();

export const Node = z.object({
  id: NonEmptyString,
  x: IntMM,
  y: IntMM,
});

export const Opening = z.object({
  id: NonEmptyString,
  type: z.enum(["door", "window"]),
  offset: IntMM,
  width: IntMM,
});

export const Wall = z.object({
  id: NonEmptyString,
  startNodeId: NonEmptyString,
  endNodeId: NonEmptyString,
  thickness: IntMM,
  openings: z.array(Opening).default([]),
  metadata: z.record(z.any()).optional(),
});

export const FloorPlanV1 = z.object({
  schemaVersion: z.literal(1),
  id: NonEmptyString,
  nodes: z.array(Node),
  walls: z.array(Wall),
  metadata: z.record(z.any()).optional(),
});

export const FloorPlan = FloorPlanV1;

export const AssetVariant = z.object({
  id: NonEmptyString,
  format: NonEmptyString,
  uri: NonEmptyString,
  lod: z.number().int().nonnegative().optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  checksum: NonEmptyString.optional(),
  metadata: z.record(z.any()).optional(),
});

export const AssetV1 = z.object({
  schemaVersion: z.literal(1),
  id: NonEmptyString,
  name: NonEmptyString,
  kind: z.enum(["model", "texture", "material", "environment", "other"]),
  source: z.enum(["catalog", "import", "generated", "unknown"]).default("unknown"),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  variants: z.array(AssetVariant).default([]),
  tags: z.array(NonEmptyString).default([]),
  metadata: z.record(z.any()).optional(),
});

export const Asset = AssetV1;

export const UserV1 = z.object({
  schemaVersion: z.literal(1),
  id: NonEmptyString,
  displayName: NonEmptyString,
  email: z.string().email().optional(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  metadata: z.record(z.any()).optional(),
});

export const User = UserV1;

export const ProjectV1 = z.object({
  schemaVersion: z.literal(1),
  id: NonEmptyString,
  name: NonEmptyString,
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  floorPlan: FloorPlan,
  assets: z.array(Asset).default([]),
  members: z.array(User).default([]),
  metadata: z.record(z.any()).optional(),
});

export const Project = ProjectV1;

export const OperationTypeValues = [
  "AddNode",
  "MoveNode",
  "DeleteNode",
  "AddWall",
  "SplitWall",
  "DeleteWall",
  "AddOpening",
  "MoveOpening",
  "SetOpeningType",
  "SetRoomLabel",
  "SetRoomType",
  "PlaceObject",
  "MoveObject",
  "RotateObject",
  "DeleteObject",
  "SetMaterial",
  "SetEnvironment",
] as const;

export const OperationType = z.enum(OperationTypeValues);

export const OperationPayload = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("AddNode"),
    node: Node,
  }),
  z.object({
    type: z.literal("MoveNode"),
    nodeId: NonEmptyString,
    dx: IntMM,
    dy: IntMM,
  }),
  z.object({
    type: z.literal("DeleteNode"),
    nodeId: NonEmptyString,
  }),
  z.object({
    type: z.literal("AddWall"),
    wall: Wall,
  }),
  z.object({
    type: z.literal("SplitWall"),
    wallId: NonEmptyString,
    atOffset: IntMM,
  }),
  z.object({
    type: z.literal("DeleteWall"),
    wallId: NonEmptyString,
  }),
  z.object({
    type: z.literal("AddOpening"),
    wallId: NonEmptyString,
    opening: Opening,
  }),
  z.object({
    type: z.literal("MoveOpening"),
    wallId: NonEmptyString,
    openingId: NonEmptyString,
    offset: IntMM,
  }),
  z.object({
    type: z.literal("SetOpeningType"),
    wallId: NonEmptyString,
    openingId: NonEmptyString,
    openingType: Opening.shape.type,
  }),
  z.object({
    type: z.literal("SetRoomLabel"),
    roomId: NonEmptyString,
    label: NonEmptyString,
  }),
  z.object({
    type: z.literal("SetRoomType"),
    roomId: NonEmptyString,
    roomType: NonEmptyString,
  }),
  z.object({
    type: z.literal("PlaceObject"),
    entityId: NonEmptyString,
    assetId: NonEmptyString,
    x: IntMM,
    y: IntMM,
    z: IntMM.default(0),
  }),
  z.object({
    type: z.literal("MoveObject"),
    entityId: NonEmptyString,
    dx: IntMM,
    dy: IntMM,
    dz: IntMM.default(0),
  }),
  z.object({
    type: z.literal("RotateObject"),
    entityId: NonEmptyString,
    yaw: z.number(),
    pitch: z.number().default(0),
    roll: z.number().default(0),
  }),
  z.object({
    type: z.literal("DeleteObject"),
    entityId: NonEmptyString,
  }),
  z.object({
    type: z.literal("SetMaterial"),
    targetId: NonEmptyString,
    materialId: NonEmptyString,
  }),
  z.object({
    type: z.literal("SetEnvironment"),
    environmentId: NonEmptyString,
  }),
]);

export const OperationV1 = z.object({
  schemaVersion: z.literal(1),
  projectId: NonEmptyString,
  clientOpId: NonEmptyString,
  actorId: NonEmptyString,
  deviceId: NonEmptyString,
  clientTime: z.number().int().nonnegative(),
  baseSeq: z.number().int().nonnegative(),
  op: OperationPayload,
});

export const Operation = OperationV1;

export type FloorPlan = z.infer<typeof FloorPlan>;
export type Project = z.infer<typeof Project>;
export type Asset = z.infer<typeof Asset>;
export type User = z.infer<typeof User>;
export type Operation = z.infer<typeof Operation>;
export type OperationPayload = z.infer<typeof OperationPayload>;

export type ValidationIssue = {
  code: string;
  message: string;
  path: string;
};

export type FloorPlanValidationIssue = {
  code:
    | "duplicate-id"
    | "missing-node"
    | "invalid-opening-span"
    | "degenerate-wall"
    | "invalid-wall-thickness"
    | "opening-exceeds-wall";
  message: string;
  path: string;
};

export type ProjectValidationIssue = {
  code: "duplicate-asset-id" | "duplicate-user-id" | "invalid-timestamp" | "floorplan-invalid";
  message: string;
  path: string;
  details?: FloorPlanValidationIssue;
};

export type AssetValidationIssue = {
  code: "duplicate-variant-id" | "invalid-timestamp" | "duplicate-tag";
  message: string;
  path: string;
};

export type UserValidationIssue = {
  code: "invalid-timestamp";
  message: string;
  path: string;
};

export type OperationValidationIssue = {
  code: "missing-op" | "invalid-base-seq";
  message: string;
  path: string;
};

const byId = <T extends { id: string }>(items: T[]) =>
  [...items].sort((a, b) => a.id.localeCompare(b.id));

const wallLengthSquared = (wall: Wall, nodesById: Map<string, Node>): number | null => {
  const start = nodesById.get(wall.startNodeId);
  const end = nodesById.get(wall.endNodeId);
  if (!start || !end) return null;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  return dx * dx + dy * dy;
};

const parseIsoDate = (value: string): Date | null => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
};

export const normalizeFloorPlan = (input: FloorPlan): FloorPlan => {
  const parsed = FloorPlan.parse(input);
  return {
    ...parsed,
    nodes: byId(parsed.nodes),
    walls: byId(parsed.walls).map((wall) => ({
      ...wall,
      openings: byId(wall.openings),
    })),
  };
};

export const validateFloorPlan = (input: FloorPlan): FloorPlanValidationIssue[] => {
  const issues: FloorPlanValidationIssue[] = [];
  const nodeIds = new Set<string>();
  const wallIds = new Set<string>();
  const nodesById = new Map<string, Node>();

  input.nodes.forEach((node, index) => {
    if (nodeIds.has(node.id)) {
      issues.push({
        code: "duplicate-id",
        message: `Duplicate node id: ${node.id}`,
        path: `nodes[${index}].id`,
      });
    }
    nodeIds.add(node.id);
    nodesById.set(node.id, node);
  });

  input.walls.forEach((wall, index) => {
    if (wallIds.has(wall.id)) {
      issues.push({
        code: "duplicate-id",
        message: `Duplicate wall id: ${wall.id}`,
        path: `walls[${index}].id`,
      });
    }
    wallIds.add(wall.id);
    if (wall.thickness <= 0) {
      issues.push({
        code: "invalid-wall-thickness",
        message: `Wall ${wall.id} thickness must be positive`,
        path: `walls[${index}].thickness`,
      });
    }
    if (!nodeIds.has(wall.startNodeId)) {
      issues.push({
        code: "missing-node",
        message: `Wall ${wall.id} missing start node ${wall.startNodeId}`,
        path: `walls[${index}].startNodeId`,
      });
    }
    if (!nodeIds.has(wall.endNodeId)) {
      issues.push({
        code: "missing-node",
        message: `Wall ${wall.id} missing end node ${wall.endNodeId}`,
        path: `walls[${index}].endNodeId`,
      });
    }
    if (wall.startNodeId === wall.endNodeId) {
      issues.push({
        code: "degenerate-wall",
        message: `Wall ${wall.id} start and end nodes are identical`,
        path: `walls[${index}]`,
      });
    }
    const lengthSquared = wallLengthSquared(wall, nodesById);
    if (lengthSquared !== null && lengthSquared === 0) {
      issues.push({
        code: "degenerate-wall",
        message: `Wall ${wall.id} has zero length`,
        path: `walls[${index}]`,
      });
    }
    const openingIds = new Set<string>();
    wall.openings.forEach((opening, openingIndex) => {
      if (openingIds.has(opening.id)) {
        issues.push({
          code: "duplicate-id",
          message: `Duplicate opening id: ${opening.id}`,
          path: `walls[${index}].openings[${openingIndex}].id`,
        });
      }
      openingIds.add(opening.id);
      if (opening.width < 0 || opening.offset < 0) {
        issues.push({
          code: "invalid-opening-span",
          message: `Opening ${opening.id} has negative span`,
          path: `walls[${index}].openings[${openingIndex}]`,
        });
      }
      if (lengthSquared !== null) {
        const span = opening.offset + opening.width;
        if (span > 0 && span * span > lengthSquared) {
          issues.push({
            code: "opening-exceeds-wall",
            message: `Opening ${opening.id} exceeds wall length`,
            path: `walls[${index}].openings[${openingIndex}]`,
          });
        }
      }
    });
  });

  return issues;
};

export const validateAsset = (input: Asset): AssetValidationIssue[] => {
  const issues: AssetValidationIssue[] = [];
  const tagIds = new Set<string>();
  input.tags.forEach((tag, index) => {
    if (tagIds.has(tag)) {
      issues.push({
        code: "duplicate-tag",
        message: `Duplicate asset tag: ${tag}`,
        path: `tags[${index}]`,
      });
    }
    tagIds.add(tag);
  });

  const variantIds = new Set<string>();
  input.variants.forEach((variant, index) => {
    if (variantIds.has(variant.id)) {
      issues.push({
        code: "duplicate-variant-id",
        message: `Duplicate asset variant id: ${variant.id}`,
        path: `variants[${index}].id`,
      });
    }
    variantIds.add(variant.id);
  });

  const created = parseIsoDate(input.createdAt);
  const updated = parseIsoDate(input.updatedAt);
  if (!created || !updated || created > updated) {
    issues.push({
      code: "invalid-timestamp",
      message: "Asset timestamps must be valid and createdAt <= updatedAt",
      path: "createdAt",
    });
  }

  return issues;
};

export const validateUser = (input: User): UserValidationIssue[] => {
  const issues: UserValidationIssue[] = [];
  const created = parseIsoDate(input.createdAt);
  const updated = parseIsoDate(input.updatedAt);
  if (!created || !updated || created > updated) {
    issues.push({
      code: "invalid-timestamp",
      message: "User timestamps must be valid and createdAt <= updatedAt",
      path: "createdAt",
    });
  }
  return issues;
};

export const validateProject = (input: Project): ProjectValidationIssue[] => {
  const issues: ProjectValidationIssue[] = [];
  const assetIds = new Set<string>();
  const memberIds = new Set<string>();

  input.assets.forEach((asset, index) => {
    if (assetIds.has(asset.id)) {
      issues.push({
        code: "duplicate-asset-id",
        message: `Duplicate asset id: ${asset.id}`,
        path: `assets[${index}].id`,
      });
    }
    assetIds.add(asset.id);
  });

  input.members.forEach((member, index) => {
    if (memberIds.has(member.id)) {
      issues.push({
        code: "duplicate-user-id",
        message: `Duplicate user id: ${member.id}`,
        path: `members[${index}].id`,
      });
    }
    memberIds.add(member.id);
  });

  const created = parseIsoDate(input.createdAt);
  const updated = parseIsoDate(input.updatedAt);
  if (!created || !updated || created > updated) {
    issues.push({
      code: "invalid-timestamp",
      message: "Project timestamps must be valid and createdAt <= updatedAt",
      path: "createdAt",
    });
  }

  const floorPlanIssues = validateFloorPlan(input.floorPlan);
  floorPlanIssues.forEach((issue) => {
    issues.push({
      code: "floorplan-invalid",
      message: issue.message,
      path: `floorPlan.${issue.path}`,
      details: issue,
    });
  });

  return issues;
};

export const validateOperation = (input: Operation): OperationValidationIssue[] => {
  const issues: OperationValidationIssue[] = [];
  if (!input.op) {
    issues.push({
      code: "missing-op",
      message: "Operation payload is required",
      path: "op",
    });
  }
  if (input.baseSeq < 0) {
    issues.push({
      code: "invalid-base-seq",
      message: "baseSeq must be non-negative",
      path: "baseSeq",
    });
  }
  return issues;
};

export type MigrationFn<T> = (input: Record<string, unknown>) => Record<string, unknown>;

const versionedInput = z
  .object({
    schemaVersion: SchemaVersion,
  })
  .passthrough();

const runMigrations = <T>(
  input: unknown,
  currentVersion: number,
  parseCurrent: (data: unknown) => T,
  migrations: Record<number, MigrationFn<T>>
): T => {
  const parsed = versionedInput.parse(input);
  let working: Record<string, unknown> = parsed;
  for (let version = parsed.schemaVersion; version < currentVersion; version += 1) {
    const migrate = migrations[version];
    if (!migrate) {
      throw new Error(`Missing migration from schema version ${version}`);
    }
    working = migrate(working);
    working.schemaVersion = version + 1;
  }
  return parseCurrent(working);
};

export const migrateProject = (input: unknown): Project =>
  runMigrations(input, CURRENT_SCHEMA_VERSION, (data) => Project.parse(data), {
    1: (data) => data,
  });

export const migrateFloorPlan = (input: unknown): FloorPlan =>
  runMigrations(input, CURRENT_SCHEMA_VERSION, (data) => FloorPlan.parse(data), {
    1: (data) => data,
  });

export const migrateAsset = (input: unknown): Asset =>
  runMigrations(input, CURRENT_SCHEMA_VERSION, (data) => Asset.parse(data), {
    1: (data) => data,
  });

export const migrateUser = (input: unknown): User =>
  runMigrations(input, CURRENT_SCHEMA_VERSION, (data) => User.parse(data), {
    1: (data) => data,
  });

export const migrateOperation = (input: unknown): Operation =>
  runMigrations(input, CURRENT_SCHEMA_VERSION, (data) => Operation.parse(data), {
    1: (data) => data,
  });

// SPEC: docs/specs/OVERARCHING_ARCHITECTURE_SPEC.md#core-data-model
export const deriveFloorPlanBounds = (input: FloorPlan) => {
  const parsed = FloorPlan.parse(input);
  const xs = parsed.nodes.map((node) => node.x);
  const ys = parsed.nodes.map((node) => node.y);
  const minX = xs.length ? Math.min(...xs) : 0;
  const maxX = xs.length ? Math.max(...xs) : 0;
  const minY = ys.length ? Math.min(...ys) : 0;
  const maxY = ys.length ? Math.max(...ys) : 0;
  return { minX, maxX, minY, maxY };
};
