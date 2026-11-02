import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { Response } from 'express';
import { ERROR_CODES, ErrorCode, ApiErrorBody } from '@backupjam/api-contract';
import { createTranslator } from '@backupjam/i18n';
import { AppError } from './app-error';
import { AppRequest, requestId, requestLocale } from './request-context';

/** Uniform, localized error envelope: { error: { code, message, details? }, requestId }. */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<AppRequest>();
    const res = ctx.getResponse<Response>();
    const { status, code, details } = this.classify(exception);
    if (status >= 500) this.logger.error({ err: exception, requestId: requestId(req) }, 'unhandled error');

    const t = createTranslator(requestLocale(req));
    const body: ApiErrorBody = {
      error: { code, message: t(ERROR_CODES[code]), ...(details !== undefined ? { details } : {}) },
      requestId: requestId(req) ?? undefined,
    };
    res.status(status).json(body);
  }

  private classify(e: unknown): { status: number; code: ErrorCode; details?: unknown } {
    if (e instanceof AppError) return { status: e.getStatus(), code: e.code, details: e.details };
    if (e instanceof ThrottlerException) return { status: HttpStatus.TOO_MANY_REQUESTS, code: 'rate_limited' };
    if (e instanceof HttpException) {
      const status = e.getStatus();
      const resp = e.getResponse() as { message?: unknown };
      if (status === HttpStatus.BAD_REQUEST) return { status, code: 'validation_failed', details: resp?.message };
      if (status === HttpStatus.NOT_FOUND) return { status, code: 'not_found' };
      if (status === HttpStatus.UNAUTHORIZED) return { status, code: 'auth.unauthorized' };
      if (status === HttpStatus.FORBIDDEN) return { status, code: 'forbidden' };
      if (status === HttpStatus.PAYLOAD_TOO_LARGE) return { status, code: 'validation_failed' };
      return { status, code: status >= 500 ? 'internal' : 'conflict' };
    }
    const pg = e as { code?: string; constraint?: string };
    if (pg?.code === '23505' && pg.constraint === 'users_email_uq') return { status: HttpStatus.CONFLICT, code: 'auth.email_taken' };
    if (pg?.code === '23505') return { status: HttpStatus.CONFLICT, code: 'conflict', details: { constraint: pg.constraint } };
    if (pg?.code === 'P0002') return { status: HttpStatus.CONFLICT, code: 'conflict', details: { reason: 'organization_requires_owner' } };
    if (pg?.code === '23503' || pg?.code === '23514' || pg?.code === '22P02') {
      return { status: HttpStatus.BAD_REQUEST, code: 'validation_failed', details: { constraint: pg.constraint } };
    }
    return { status: HttpStatus.INTERNAL_SERVER_ERROR, code: 'internal' };
  }
}
