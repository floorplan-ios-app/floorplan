import * as repos from "../db/repos";

export type DbStorage = {
  projects: {
    create: typeof repos.createProject;
    update: typeof repos.updateProject;
    delete: typeof repos.deleteProject;
    get: typeof repos.getProject;
    list: typeof repos.listProjects;
    appendOps: typeof repos.appendOps;
    getOpsAfter: typeof repos.getOpsAfter;
  };
  assets: {
    create: typeof repos.createAsset;
    get: typeof repos.getAsset;
    list: typeof repos.listAssets;
    updateMetadata: typeof repos.updateAssetMetadata;
    addVariant: typeof repos.addAssetVariant;
    listVariants: typeof repos.listAssetVariants;
  };
  jobs: {
    enqueue: typeof repos.enqueueJob;
    list: typeof repos.listJobs;
  };
  auth: {
    createSession: typeof repos.createAuthSession;
    getSessionByAccessToken: typeof repos.getSessionByAccessToken;
    rotateSessionByRefresh: typeof repos.rotateSessionByRefresh;
    revokeSession: typeof repos.revokeSession;
  };
  audit: {
    log: typeof repos.createAuditLog;
  };
};

export function createDbStorage(): DbStorage {
  return {
    projects: {
      create: repos.createProject,
      update: repos.updateProject,
      delete: repos.deleteProject,
      get: repos.getProject,
      list: repos.listProjects,
      appendOps: repos.appendOps,
      getOpsAfter: repos.getOpsAfter,
    },
    assets: {
      create: repos.createAsset,
      get: repos.getAsset,
      list: repos.listAssets,
      updateMetadata: repos.updateAssetMetadata,
      addVariant: repos.addAssetVariant,
      listVariants: repos.listAssetVariants,
    },
    jobs: {
      enqueue: repos.enqueueJob,
      list: repos.listJobs,
    },
    auth: {
      createSession: repos.createAuthSession,
      getSessionByAccessToken: repos.getSessionByAccessToken,
      rotateSessionByRefresh: repos.rotateSessionByRefresh,
      revokeSession: repos.revokeSession,
    },
    audit: {
      log: repos.createAuditLog,
    },
  };
}
