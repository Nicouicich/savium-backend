// Type extensions for Express Request object
declare namespace Express {
  interface Request {
    traceId: string;
    user?: {
      sub: string;
      id: string;
      email: string;
      role: string;
      isEmailVerified?: boolean;
      activeProfileId?: string;
    };
  }
}
