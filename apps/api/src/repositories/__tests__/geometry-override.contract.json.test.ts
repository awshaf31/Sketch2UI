import { db } from "../../db/jsonStore.js";
import { JsonAssetRepository } from "../json/asset.repository.js";
import { JsonDetectionRepository } from "../json/detection.repository.js";
import { JsonGeometryOverrideRepository } from "../json/geometry-override.repository.js";
import { JsonProjectRepository } from "../json/project.repository.js";
import { runGeometryOverrideRepositoryContract } from "./geometry-override.contract.js";

/** JSON arm — always runs; needs no external service. */
runGeometryOverrideRepositoryContract(
  "JSON adapter",
  async () => ({
    geometryOverrides: new JsonGeometryOverrideRepository(),
    detections: new JsonDetectionRepository(),
    assets: new JsonAssetRepository(),
    projects: new JsonProjectRepository(),
  }),
  () => {
    db.reset();
  }
);
