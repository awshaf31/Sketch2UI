import { db } from "../../db/jsonStore.js";
import { JsonUserRepository } from "../json/user.repository.js";
import { runUserRepositoryContract } from "./user.contract.js";

runUserRepositoryContract(
  "JSON adapter",
  () => new JsonUserRepository(),
  () => {
    db.reset();
  }
);
