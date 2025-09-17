import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';
import { UserMapper } from '../../users/utils';
import { UserForJWT } from '../../users/types';

export interface JwtPayload {
  sub: string; // User ID
  email: string;
  role: string;
  iat: number;
  exp?: number; // Optional - will be set by JWT service
}

export interface JwtRefreshPayload {
  sub: string; // User ID
  email: string;
  role: string;
  tokenId: string;
  iat: number;
  exp?: number; // Optional - will be set by JWT service
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('jwt.accessToken.secret'),
      issuer: configService.get('jwt.options.issuer'),
      audience: configService.get('jwt.options.audience')
    });
  }

  async validate(payload: JwtPayload): Promise<UserForJWT> {
    try {
      // Find user by MongoDB ObjectId from token payload
      const user = await this.usersService.findById(payload.sub);

      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found or inactive');
      }

      // Return properly typed user object for JWT validation
      return UserMapper.toJWTUser(user);
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
