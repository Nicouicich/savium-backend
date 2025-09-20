import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-facebook';
import { AuthService } from '../auth.service';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  private readonly logger = new Logger(FacebookStrategy.name);

  constructor(
    private configService: ConfigService,
    private authService: AuthService
  ) {
    super({
      clientID: configService.get('facebook.clientId'),
      clientSecret: configService.get('facebook.clientSecret'),
      callbackURL: configService.get('facebook.callbackUrl'),
      scope: ['email', 'public_profile'],
      profileFields: ['id', 'name', 'email', 'picture.type(large)']
    });

    // Log OAuth configuration for debugging
    this.logger.debug('Facebook OAuth Strategy initialized with config:', {
      clientID: configService.get('facebook.clientId')?.substring(0, 10) + '...',
      callbackURL: configService.get('facebook.callbackUrl'),
      scope: ['email', 'public_profile']
    });
  }

  async validate(accessToken: string, refreshToken: string, profile: any, done: any): Promise<any> {
    try {
      this.logger.debug('Facebook OAuth validation started', {
        profileId: profile?.id,
        email: profile?.emails?.[0]?.value,
        name: profile?.name
      });

      // Validate profile data
      if (!profile) {
        this.logger.error('No profile data received from Facebook');
        return done(new Error('No profile data received from Facebook'), false);
      }

      const { id, name, emails, photos } = profile;

      // Validate required fields
      if (!id || !emails || !emails[0]?.value || !name) {
        this.logger.error('Incomplete profile data from Facebook', {
          hasId: !!id,
          hasEmails: !!emails?.[0]?.value,
          hasName: !!name
        });
        return done(new Error('Incomplete profile data from Facebook'), false);
      }

      const oauthData = {
        oauthProvider: 'facebook',
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

      this.logger.log('Facebook OAuth validation successful', {
        userId: user.id || user._id,
        email: user.email
      });

      done(null, user);
    } catch (error) {
      this.logger.error('Facebook OAuth validation failed', {
        error: error.message,
        stack: error.stack,
        profileId: profile?.id,
        email: profile?.emails?.[0]?.value
      });
      done(error, false);
    }
  }
}
