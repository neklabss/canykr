import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { OIDC_KEYS, OidcVerifier, remoteOidcKeys } from './oidc';
import { SessionService } from './session.service';
import { TokenService } from './tokens';

@Module({
  controllers: [AuthController],
  providers: [
    TokenService,
    SessionService,
    AuthService,
    OidcVerifier,
    { provide: OIDC_KEYS, useFactory: remoteOidcKeys },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [AuthService, SessionService, TokenService],
})
export class AuthModule {}
