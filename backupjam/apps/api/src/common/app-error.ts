import { HttpException, HttpStatus } from '@nestjs/common';
import type { ErrorCode } from '@backupjam/api-contract';

/** Domain-level error with a stable machine code; the HTTP filter localizes the message. */
export class AppError extends HttpException {
  constructor(public readonly code: ErrorCode, status: HttpStatus, public readonly details?: unknown) {
    super({ code, details }, status);
  }

  static unauthorized(code: ErrorCode = 'auth.unauthorized') { return new AppError(code, HttpStatus.UNAUTHORIZED); }
  static forbidden(details?: unknown) { return new AppError('forbidden', HttpStatus.FORBIDDEN, details); }
  static notFound() { return new AppError('not_found', HttpStatus.NOT_FOUND); }
  static conflict(code: ErrorCode = 'conflict', details?: unknown) { return new AppError(code, HttpStatus.CONFLICT, details); }
  static validation(details?: unknown) { return new AppError('validation_failed', HttpStatus.BAD_REQUEST, details); }
}
