import { db } from "../../db/jsonStore.js";
import { JsonAssetRepository } from "../json/asset.repository.js";
import { JsonDetectionRepository } from "../json/detection.repository.js";
import { JsonProjectRepository } from "../json/project.repository.js";
import { JsonStyleOverrideRepository } from "../json/style-override.repository.js";
import { runStyleOverrideRepositoryContract } from "./style-override.contract.js";

/** JSON arm — always runs; needs no external service. */
runStyleOverrideRepositoryContract(
  "JSON adapter",
  async () => ({
    styleOverrides: new JsonStyleOverrideRepository(),
    detections: new JsonDetectionRepository(),
    assets: new JsonAssetRepository(),
    projects: new JsonProjectRepository(),
  }),
  () => {
    // Safe only because vitest.setup.ts redirected STORE_FILE to a temp file first.
    db.reset();
  }
);
