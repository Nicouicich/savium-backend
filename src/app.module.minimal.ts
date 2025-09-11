import {Module} from '@nestjs/common';
import {ConfigModule, ConfigService} from '@nestjs/config';
import {MongooseModule} from '@nestjs/mongoose';
import {AppController} from './app.controller';
import {AppService} from './app.service';

// Configuration imports
import {appConfig, configValidationSchema, databaseConfig, jwtConfig} from './config';

// Module imports
import {AuthModule} from './auth/auth.module';
import {UsersModule} from './users/users.module';

@Module({
  imports: [
    // Configuration Module
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      validationSchema: configValidationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false
      },
      load: [appConfig, databaseConfig, jwtConfig]
    }),

    // Database Module
    MongooseModule.forRootAsync({
      useFactory: (configService: ConfigService) => {
        const dbOptions = configService.get('database.options') || {};
        return {
          uri: configService.get('database.uri'),
          ...dbOptions
        };
      },
      inject: [ConfigService]
    }),

    // Application modules
    AuthModule,
    UsersModule
  ],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule {}
