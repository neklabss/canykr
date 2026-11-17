import { Global, Injectable, Module } from '@nestjs/common';
import { Db, Queryable } from '../../database/db';

export interface AuditEntry {
  actorUserId: string | null;
  actorType: 'user' | 'staff' | 'system' | 'provider_webhook';
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  requestId?: string | null;
}

const SECRET_KEYS = /pass(word)?|token|secret|authorization|cookie/i;

/** Writes to the append-only audit_logs table. Pass the transaction client to keep audit + change atomic. */
@Injectable()
export class AuditService {
  constructor(private readonly db: Db) {}

  async record(entry: AuditEntry, client?: Queryable): Promise<void> {
    const metadata = Object.fromEntries(Object.entries(entry.metadata ?? {}).filter(([k]) => !SECRET_KEYS.test(k)));
    await this.db.query(
      `INSERT INTO audit_logs (actor_user_id, actor_type, action, target_type, target_id, metadata, ip, request_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [entry.actorUserId, entry.actorType, entry.action, entry.targetType ?? null, entry.targetId ?? null, metadata, entry.ip ?? null, entry.requestId ?? null],
      client,
    );
  }
}

@Global()
@Module({ providers: [AuditService], exports: [AuditService] })
export class AuditModule {}
