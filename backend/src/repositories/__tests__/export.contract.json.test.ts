import { db } from "../../db/jsonStore.js";
import { JsonCodeVersionRepository } from "../json/code-version.repository.js";
import { JsonExportRepository } from "../json/export.repository.js";
import { JsonProjectRepository } from "../json/project.repository.js";
import { JsonPageRepository } from "../json/page.repository.js";
import { runExportRepositoryContract } from "./export.contract.js";

/** JSON arm — always runs; needs no external service. */
runExportRepositoryContract(
  "JSON adapter",
  async () => ({
    exports: new JsonExportRepository(),
    codeVersions: new JsonCodeVersionRepository(),
    projects: new JsonProjectRepository(),
    pages: new JsonPageRepository(),
  }),
  () => {
    db.reset();
  }
);
