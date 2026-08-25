import { db } from "../../db/jsonStore.js";
import { JsonAssetRepository } from "../json/asset.repository.js";
import { JsonJobRepository } from "../json/job.repository.js";
import { JsonProjectRepository } from "../json/project.repository.js";
import { runJobRepositoryContract } from "./job.contract.js";

/** JSON arm — always runs; needs no external service. */
runJobRepositoryContract(
  "JSON adapter",
  async () => ({
    jobs: new JsonJobRepository(),
    projects: new JsonProjectRepository(),
    assets: new JsonAssetRepository(),
  }),
  () => {
    db.reset();
  }
);
