import type { Response } from "express";

// Plan section 7.6: consistent error JSON. Never surface a Python traceback (or a Node
// stack) to the browser.
//
//   { "error": { "code": "INVALID_IMAGE", "message": "…", "retryable": false } }
//
// `retryable` follows the section 27.4 classification. There is no queue to retry within
// yet (see modules/jobs), but the distinction is recorded rather than thrown away so a
// future BullMQ worker can act on it without re-deriving it.

export type ErrorCode =
  | "INVALID_IMAGE"
  | "NOT_FOUND"
  | "VALIDATION_FAILED"
  | "MODEL_UNAVAILABLE"
  | "WORKER_UNREACHABLE"
  | "INFERENCE_FAILED"
  | "INTERNAL";

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    retryable: boolean;
  };
}

const RETRYABLE: ReadonlySet<ErrorCode> = new Set<ErrorCode>([
  "MODEL_UNAVAILABLE",
  "WORKER_UNREACHABLE",
  "INFERENCE_FAILED",
]);

export function isRetryable(code: ErrorCode): boolean {
  return RETRYABLE.has(code);
}

export function apiError(code: ErrorCode, message: string): ApiErrorBody {
  return { error: { code, message, retryable: isRetryable(code) } };
}

export function sendError(
  res: Response,
  status: number,
  code: ErrorCode,
  message: string
): Response {
  return res.status(status).json(apiError(code, message));
}
