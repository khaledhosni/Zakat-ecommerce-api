import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { RefreshTokenService } from './refresh-token.service.js';

@Global()
@Module({
  imports: [PrismaModule,

      JwtModule.registerAsync({
      imports: [ConfigModule],
    inject: [ConfigService],

      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),

        signOptions: {
          expiresIn: '1h',
          
        },
      }),
    }),
  ],

  controllers: [AuthController],
  providers: [AuthService, RefreshTokenService],
  exports: [JwtModule, RefreshTokenService],
})
export class AuthModule {}
