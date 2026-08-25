import { db } from "../../db/jsonStore.js";
import { JsonAssetRepository } from "../json/asset.repository.js";
import { JsonContentOverrideRepository } from "../json/content-override.repository.js";
import { JsonDetectionRepository } from "../json/detection.repository.js";
import { JsonProjectRepository } from "../json/project.repository.js";
import { runContentOverrideRepositoryContract } from "./content-override.contract.js";

/** JSON arm — always runs; needs no external service. */
runContentOverrideRepositoryContract(
  "JSON adapter",
  async () => ({
    contentOverrides: new JsonContentOverrideRepository(),
    detections: new JsonDetectionRepository(),
    assets: new JsonAssetRepository(),
    projects: new JsonProjectRepository(),
  }),
  () => {
    db.reset();
  }
);
