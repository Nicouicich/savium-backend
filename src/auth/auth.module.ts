import { CommonModule } from '@common/common.module';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { FacebookStrategy } from './strategies/facebook.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),

    // JWT Configuration
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('jwt.accessToken.secret'),
        signOptions: {
          expiresIn: configService.get('jwt.accessToken.expiresIn'),
          issuer: configService.get('jwt.options.issuer'),
          audience: configService.get('jwt.options.audience')
        }
      }),
      inject: [ConfigService]
    }),

    // Import Users module for user operations
    UsersModule,
    CommonModule
  ],

  controllers: [AuthController],

  providers: [AuthService, LocalStrategy, JwtStrategy, JwtRefreshStrategy, GoogleStrategy, FacebookStrategy],

  exports: [AuthService, JwtStrategy, JwtRefreshStrategy, GoogleStrategy, FacebookStrategy]
})
export class AuthModule {}
