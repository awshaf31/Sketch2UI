import { db } from "../../db/jsonStore.js";
import { JsonAssetRepository } from "../json/asset.repository.js";
import { JsonCorrectionRepository } from "../json/correction.repository.js";
import { JsonDetectionRepository } from "../json/detection.repository.js";
import { JsonProjectRepository } from "../json/project.repository.js";
import { runCorrectionRepositoryContract } from "./correction.contract.js";

/** JSON arm — always runs; needs no external service. */
runCorrectionRepositoryContract(
  "JSON adapter",
  async () => ({
    corrections: new JsonCorrectionRepository(),
    detections: new JsonDetectionRepository(),
    assets: new JsonAssetRepository(),
    projects: new JsonProjectRepository(),
  }),
  () => {
    db.reset();
  }
);
