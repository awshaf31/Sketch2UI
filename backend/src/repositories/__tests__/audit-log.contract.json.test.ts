import { db } from "../../db/jsonStore.js";
import { JsonAuditLogRepository } from "../json/audit-log.repository.js";
import { runAuditLogRepositoryContract } from "./audit-log.contract.js";

runAuditLogRepositoryContract(
  "JSON adapter",
  () => new JsonAuditLogRepository(),
  () => {
    db.reset();
  }
);
