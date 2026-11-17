import { Pool, PoolClient, QueryResultRow } from 'pg';

export type Queryable = Pick<PoolClient, 'query'>;

/** Thin, explicit data-access helper. SQL stays visible and reviewable (financial tables especially). */
export class Db {
  constructor(public readonly pool: Pool) {}

  async query<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = [], client?: Queryable): Promise<T[]> {
    const res = await (client ?? this.pool).query<T>(sql, params as unknown[]);
    return res.rows;
  }

  async one<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = [], client?: Queryable): Promise<T | undefined> {
    return (await this.query<T>(sql, params, client))[0];
  }

  async tx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }
}
