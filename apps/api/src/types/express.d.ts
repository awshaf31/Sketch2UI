// Set by middleware/requireAuth.ts once a session cookie resolves to a user.
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export {};
