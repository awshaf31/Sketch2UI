import { db } from "../../db/jsonStore.js";
import { JsonSessionRepository } from "../json/session.repository.js";
import { JsonUserRepository } from "../json/user.repository.js";
import { runSessionRepositoryContract } from "./session.contract.js";

runSessionRepositoryContract(
  "JSON adapter",
  async () => ({
    sessions: new JsonSessionRepository(),
    users: new JsonUserRepository(),
  }),
  () => {
    db.reset();
  }
);
