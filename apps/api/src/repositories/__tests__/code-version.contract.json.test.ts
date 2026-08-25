import { db } from "../../db/jsonStore.js";
import { JsonCodeVersionRepository } from "../json/code-version.repository.js";
import { JsonProjectRepository } from "../json/project.repository.js";
import { JsonPageRepository } from "../json/page.repository.js";
import { runCodeVersionRepositoryContract } from "./code-version.contract.js";

/** JSON arm — always runs; needs no external service. */
runCodeVersionRepositoryContract(
  "JSON adapter",
  async () => ({
    codeVersions: new JsonCodeVersionRepository(),
    projects: new JsonProjectRepository(),
    pages: new JsonPageRepository(),
  }),
  () => {
    // Safe only because vitest.setup.ts redirected STORE_FILE to a temp file first.
    db.reset();
  }
);
