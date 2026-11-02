import { DynamicModule, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { ENV, Env } from './config/env';
import { rateLimits } from './config/rate-limits';
import { DatabaseModule } from './database/database.module';
import { AuditModule } from './modules/audit/audit.service';
import { MailModule } from './modules/mail/mailer';
import { UsersCoreModule } from './modules/users/me.query';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { ReferenceModule } from './modules/reference/reference.module';
import { AdminModule } from './modules/admin/admin.module';
import { HealthModule } from './modules/health/health.controller';

/**
 * Modular monolith root. Domain modules (auth, users, organizations, reference, admin …) talk through
 * exported services only; Phase 2+ modules (profiles, jobs, search, messaging, offers, bookings,
 * payments) plug in here without new deployables.
 */
@Module({})
export class AppModule {
  static register(env: Env): DynamicModule {
    rateLimits.default = env.RATE_LIMIT_DEFAULT;
    rateLimits.auth = env.RATE_LIMIT_AUTH;
    return {
      module: AppModule,
      global: true,
      imports: [
        LoggerModule.forRoot({
          pinoHttp: {
            level: env.LOG_LEVEL,
            genReqId: (req, res) => {
              const incoming = req.headers['x-request-id'];
              const id = typeof incoming === 'string' && /^[\w-]{8,64}$/.test(incoming) ? incoming : randomUUID();
              res.setHeader('X-Request-Id', id);
              return id;
            },
            redact: { paths: ['req.headers.authorization', 'req.headers.cookie', 'req.body.password', 'req.body.newPassword', 'req.body.refreshToken', 'req.body.idToken', 'req.body.token'], remove: true },
            transport: env.NODE_ENV === 'development' ? { target: 'pino-pretty', options: { singleLine: true } } : undefined,
          },
        }),
        ThrottlerModule.forRoot({ throttlers: [{ name: 'default', ttl: 60_000, limit: () => rateLimits.default }] }),
        DatabaseModule,
        AuditModule,
        MailModule,
        UsersCoreModule,
        AuthModule,
        UsersModule,
        OrganizationsModule,
        ReferenceModule,
        AdminModule,
        HealthModule,
      ],
      providers: [{ provide: ENV, useValue: env }, { provide: APP_GUARD, useClass: ThrottlerGuard }],
      exports: [ENV],
    };
  }
}
