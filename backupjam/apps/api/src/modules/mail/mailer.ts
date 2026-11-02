import { Global, Inject, Injectable, Logger, Module } from '@nestjs/common';
import { createTranslator } from '@backupjam/i18n';
import { ENV, Env } from '../../config/env';

export interface OutgoingMail {
  to: string;
  subject: string;
  text: string;
  /** Template identifier, useful for tests and provider templates. */
  template: 'verify_email' | 'reset_password';
  data: Record<string, string>;
}

/** Transactional mail port. Real providers (SES, Postmark, SendGrid…) implement this interface. */
export interface Mailer {
  send(mail: OutgoingMail): Promise<void>;
}
export const MAILER = Symbol('MAILER');

/**
 * ⚠️ MOCK MAILER — does NOT deliver email. Logs messages and keeps them in an in-memory outbox
 * so developers and tests can read verification / reset links. Never use in production.
 */
@Injectable()
export class ConsoleMockMailer implements Mailer {
  private readonly logger = new Logger('MockMailer');
  readonly outbox: OutgoingMail[] = [];

  async send(mail: OutgoingMail): Promise<void> {
    this.outbox.push(mail);
    if (this.outbox.length > 500) this.outbox.shift();
    this.logger.log(`[MOCK EMAIL] to=${mail.to} template=${mail.template} subject="${mail.subject}"`);
  }
}

/** Builds localized transactional emails from i18n resources (no hard-coded copy). */
@Injectable()
export class MailComposer {
  constructor(@Inject(ENV) private readonly env: Env, @Inject(MAILER) private readonly mailer: Mailer) {}

  async verifyEmail(to: string, locale: string, token: string) {
    const t = createTranslator(locale);
    const link = `${this.env.APP_WEB_URL}/${locale}/verify-email?token=${encodeURIComponent(token)}`;
    await this.mailer.send({ to, template: 'verify_email', data: { link, token }, subject: t('email.verify.subject'), text: t('email.verify.body', { link }) });
  }

  async resetPassword(to: string, locale: string, token: string) {
    const t = createTranslator(locale);
    const link = `${this.env.APP_WEB_URL}/${locale}/reset-password?token=${encodeURIComponent(token)}`;
    await this.mailer.send({ to, template: 'reset_password', data: { link, token }, subject: t('email.reset.subject'), text: t('email.reset.body', { link }) });
  }
}

@Global()
@Module({
  providers: [{ provide: MAILER, useClass: ConsoleMockMailer }, MailComposer],
  exports: [MAILER, MailComposer],
})
export class MailModule {}
