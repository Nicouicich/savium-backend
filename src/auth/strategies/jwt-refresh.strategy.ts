import {Injectable, UnauthorizedException} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {PassportStrategy} from '@nestjs/passport';
import {ExtractJwt, Strategy} from 'passport-jwt';
import {UsersService} from '../../users/users.service';

export interface JwtRefreshPayload {
  sub: string; // User ID
  email: string;
  tokenId: string; // Unique token identifier
  iat: number;
  exp: number;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: configService.get('jwt.refreshToken.secret'),
      issuer: configService.get('jwt.options.issuer'),
      audience: configService.get('jwt.options.audience'),
      passReqToCallback: true
    });
  }

  async validate(request: any, payload: JwtRefreshPayload) {
    try {
      const {refreshToken} = request.body;

      // Find user by ID from token payload
      const user = await this.usersService.findById(payload.sub);

      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found or inactive');
      }

      // Check if refresh token is valid and stored in user's refresh tokens
      if (!user.refreshTokens?.includes(refreshToken)) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Return user object with the refresh token for removal
      return {
        id: user.id || user._id,
        email: user.email,
        role: user.role,
        refreshToken
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
