import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleStrategy.name);

  constructor(
    private configService: ConfigService,
    private authService: AuthService
  ) {
    super({
      clientID: configService.get('google.clientId'),
      clientSecret: configService.get('google.clientSecret'),
      callbackURL: configService.get('google.callbackUrl'),
      scope: ['email', 'profile']
    });

    // Log OAuth configuration for debugging
    this.logger.debug('Google OAuth Strategy initialized with config:', {
      clientID: configService.get('google.clientId')?.substring(0, 10) + '...',
      callbackURL: configService.get('google.callbackUrl'),
      scope: ['email', 'profile']
    });
  }

  async validate(accessToken: string, refreshToken: string, profile: any, done: VerifyCallback): Promise<any> {
    try {
      this.logger.debug('Google OAuth validation started', {
        profileId: profile?.id,
        email: profile?.emails?.[0]?.value,
        name: profile?.name
      });

      // Validate profile data
      if (!profile) {
        this.logger.error('No profile data received from Google');
        return done(new Error('No profile data received from Google'), false);
      }

      const { id, name, emails, photos } = profile;

      // Validate required fields
      if (!id || !emails || !emails[0]?.value || !name) {
        this.logger.error('Incomplete profile data from Google', {
          hasId: !!id,
          hasEmails: !!emails?.[0]?.value,
          hasName: !!name
        });
        return done(new Error('Incomplete profile data from Google'), false);
      }

      const oauthData = {
        oauthProvider: 'google',
        oauthProviderId: id,
        email: emails[0].value,
        firstName: name.givenName || '',
        lastName: name.familyName || '',
        profilePicture: photos?.[0]?.value
      };

      this.logger.debug('Calling validateOAuthUser with data:', {
        provider: oauthData.oauthProvider,
        email: oauthData.email,
        hasFirstName: !!oauthData.firstName,
        hasLastName: !!oauthData.lastName
      });

      const user = await this.authService.validateOAuthUser(oauthData);

      if (!user) {
        this.logger.error('OAuth user validation returned null');
        return done(new Error('Failed to validate OAuth user'), false);
      }

      this.logger.log('Google OAuth validation successful', {
        userId: user.id || user._id,
        email: user.email
      });

      done(null, user);
    } catch (error) {
      this.logger.error('Google OAuth validation failed', {
        error: error.message,
        stack: error.stack,
        profileId: profile?.id,
        email: profile?.emails?.[0]?.value
      });
      done(error, false);
    }
  }
}
