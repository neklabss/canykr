import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { Pool } from 'pg';
import { ENV, Env } from '../config/env';
import { Db } from './db';

export const PG_POOL = Symbol('PG_POOL');

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ENV],
      useFactory: (env: Env) => new Pool({ connectionString: env.DATABASE_URL, max: 20, idleTimeoutMillis: 30_000 }),
    },
    { provide: Db, inject: [PG_POOL], useFactory: (pool: Pool) => new Db(pool) },
  ],
  exports: [PG_POOL, Db],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}
  async onApplicationShutdown() {
    await this.pool.end();
  }
}
