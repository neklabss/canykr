/** Stable machine error codes → localization keys (packages/i18n). Codes never change meaning once shipped. */
export const ERROR_CODES = {
  'auth.invalid_credentials': 'errors.invalidCredentials',
  'auth.email_taken': 'errors.emailTaken',
  'auth.weak_password': 'errors.weakPassword',
  'auth.unauthorized': 'errors.unauthorized',
  'auth.token_invalid': 'errors.unauthorized',
  'auth.refresh_reused': 'errors.unauthorized',
  'auth.account_suspended': 'errors.forbidden',
  'auth.identity_conflict': 'errors.emailTaken',
  'auth.provider_not_configured': 'errors.notFound',
  'forbidden': 'errors.forbidden',
  'not_found': 'errors.notFound',
  'validation_failed': 'errors.validation',
  'rate_limited': 'errors.rateLimited',
  'conflict': 'errors.validation',
  'internal': 'states.errorBody',
} as const;
export type ErrorCode = keyof typeof ERROR_CODES;
