import { db } from "../../db/jsonStore.js";
import { JsonAssetRepository } from "../json/asset.repository.js";
import { JsonProjectRepository } from "../json/project.repository.js";
import { JsonTrainingRepository } from "../json/training.repository.js";
import { runTrainingRepositoryContract } from "./training.contract.js";

/** JSON arm — always runs; needs no external service. */
runTrainingRepositoryContract(
  "JSON adapter",
  async () => ({
    training: new JsonTrainingRepository(),
    assets: new JsonAssetRepository(),
    projects: new JsonProjectRepository(),
  }),
  () => {
    db.reset();
  }
);
