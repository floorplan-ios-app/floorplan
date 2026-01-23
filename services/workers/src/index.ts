/**
 * Background job workers (scaffold).
 *
 * Intended jobs:
 * - asset import/validation
 * - glTF/USdz conversions and optimization
 * - thumbnail rendering
 * - AI generation requests (server-mediated)
 */

import { createLogger } from "./observability";

const logger = createLogger("workers");

logger.info("workers.start", {
  jobsConfigured: false,
  note: "workers scaffold: no jobs configured yet",
});
