import {Request} from 'express';

export interface AuthenticatedUser {
  sub: string;
  id: string;
  email: string;
  role: string;
  isEmailVerified?: boolean;
  activeProfileId?: string;
}

export interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}
