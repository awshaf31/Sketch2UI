import { db } from "../../db/jsonStore.js";
import { JsonAssetRepository } from "../json/asset.repository.js";
import { JsonDetectionRepository } from "../json/detection.repository.js";
import { JsonPageRepository } from "../json/page.repository.js";
import { JsonProjectRepository } from "../json/project.repository.js";
import { runDetectionRepositoryContract } from "./detection.contract.js";

/** JSON arm — always runs; needs no external service. */
runDetectionRepositoryContract(
  "JSON adapter",
  async () => ({
    detections: new JsonDetectionRepository(),
    assets: new JsonAssetRepository(),
    projects: new JsonProjectRepository(),
    pages: new JsonPageRepository(),
  }),
  () => {
    // Safe only because vitest.setup.ts redirected STORE_FILE to a temp file first.
    db.reset();
  }
);
