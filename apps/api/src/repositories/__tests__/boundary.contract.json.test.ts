import { db } from "../../db/jsonStore.js";
import { JsonAssetRepository } from "../json/asset.repository.js";
import { JsonBoundaryRepository } from "../json/boundary.repository.js";
import { JsonProjectRepository } from "../json/project.repository.js";
import { runBoundaryRepositoryContract } from "./boundary.contract.js";

/** JSON arm — always runs; needs no external service. */
runBoundaryRepositoryContract(
  "JSON adapter",
  async () => ({
    boundaries: new JsonBoundaryRepository(),
    assets: new JsonAssetRepository(),
    projects: new JsonProjectRepository(),
  }),
  () => {
    // Safe only because vitest.setup.ts redirected STORE_FILE to a temp file first.
    db.reset();
  }
);
