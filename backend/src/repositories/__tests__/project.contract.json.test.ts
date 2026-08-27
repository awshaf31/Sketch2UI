import { db } from "../../db/jsonStore.js";
import { JsonProjectRepository } from "../json/project.repository.js";
import { runProjectRepositoryContract } from "./project.contract.js";

/**
 * JSON arm of the ProjectRepository contract. Always runs — it needs no external
 * service. Identical assertions to the Prisma arm; see project.contract.ts.
 */
runProjectRepositoryContract(
  "JSON adapter",
  () => new JsonProjectRepository(),
  () => {
    // Safe only because vitest.setup.ts redirected STORE_FILE to a temp file and
    // asserted the redirect took effect before any module loaded. db.reset() writes
    // to whatever env.storeFile resolves to.
    db.reset();
  }
);
