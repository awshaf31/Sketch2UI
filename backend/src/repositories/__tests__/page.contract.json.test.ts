import { db } from "../../db/jsonStore.js";
import { JsonPageRepository } from "../json/page.repository.js";
import { JsonProjectRepository } from "../json/project.repository.js";
import { runPageRepositoryContract } from "./page.contract.js";

runPageRepositoryContract(
  "JSON adapter",
  async () => ({
    pages: new JsonPageRepository(),
    projects: new JsonProjectRepository(),
  }),
  () => {
    db.reset();
  }
);
