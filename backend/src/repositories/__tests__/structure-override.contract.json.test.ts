import { db } from "../../db/jsonStore.js";
import { JsonAssetRepository } from "../json/asset.repository.js";
import { JsonDetectionRepository } from "../json/detection.repository.js";
import { JsonProjectRepository } from "../json/project.repository.js";
import { JsonStructureOverrideRepository } from "../json/structure-override.repository.js";
import { JsonPageRepository } from "../json/page.repository.js";
import { runStructureOverrideRepositoryContract } from "./structure-override.contract.js";

/** JSON arm — always runs; needs no external service. */
runStructureOverrideRepositoryContract(
  "JSON adapter",
  async () => ({
    structureOverrides: new JsonStructureOverrideRepository(),
    detections: new JsonDetectionRepository(),
    assets: new JsonAssetRepository(),
    projects: new JsonProjectRepository(),
    pages: new JsonPageRepository(),
  }),
  () => {
    db.reset();
  }
);
