import type { ErrorRequestHandler } from "express";
import { apiError } from "./apiError.js";

// Last-resort handler. Emits the plan's §7.6 error shape like every other route, so the
// client never has to branch on where an error came from. The internal message is logged
// but not returned — §7.6: do not expose stack traces to the browser.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  res.status(500).json(apiError("INTERNAL", "An unexpected server error occurred."));
};
