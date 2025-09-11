// Type extensions for Express Request object
declare namespace Express {
  interface Request {
    traceId: string;
    user?: {
      id: string;
      email: string;
      role: string;
    };
  }
}
