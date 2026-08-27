import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Wrap an async route handler so a rejected promise reaches Express's error handler.
 *
 * WHY THIS IS REQUIRED BY THE PHASE 8 MIGRATION
 *
 * This project runs Express 4. Express 4 does not understand promises: if a handler
 * returns a rejected one, nothing catches it. The request never gets a response — the
 * client hangs until it times out — and Node reports an unhandled rejection. Express 5
 * fixes this natively, but upgrading Express mid-persistence-migration would mean
 * changing two risky things at once.
 *
 * Before Phase 8 the API had two async handlers and both were `try/catch`-complete, so
 * the gap never showed. Converting persistence to Prisma makes EVERY handler async and
 * every one of them capable of rejecting (connection lost, constraint violation,
 * timeout), so the gap stops being theoretical.
 *
 * Passing the error to `next` routes it to errorHandler, which already returns the
 * §7.6 error shape — so a database failure surfaces as a normal 500 envelope rather
 * than a hung socket.
 */
export function asyncHandler<P = Record<string, string>>(
  handler: (req: Request<P>, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler<P> {
  return (req, res, next) => {
    // `void` the promise deliberately: the rejection path is handled by `.catch(next)`,
    // and returning the promise to Express 4 would do nothing useful.
    void Promise.resolve(handler(req as Request<P>, res, next)).catch(next);
  };
}
