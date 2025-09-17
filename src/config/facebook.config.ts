import { registerAs } from '@nestjs/config';

export default registerAs('facebook', () => ({
  clientId: process.env.FACEBOOK_CLIENT_ID,
  clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
  callbackUrl: process.env.FACEBOOK_CALLBACK_URL || `${process.env.APP_URL || 'http://localhost:3000'}/api/v1/auth/facebook/callback`,
  scope: ['email', 'public_profile']
}));
