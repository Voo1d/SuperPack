import { Global, Inject, Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { AppConfig, CONFIG } from '../config';
import * as schema from './schema';

export const DB = Symbol('DB');
export const PG_POOL = Symbol('PG_POOL');
export type Database = NodePgDatabase<typeof schema>;
/** Транзакция Drizzle имеет тот же интерфейс запросов, что и база. */
export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

@Injectable()
class PoolCloser implements OnModuleDestroy {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}
  async onModuleDestroy() {
    await this.pool.end();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [CONFIG],
      useFactory: (config: AppConfig) => new Pool({ connectionString: config.databaseUrl, max: 10 }),
    },
    { provide: DB, inject: [PG_POOL], useFactory: (pool: Pool): Database => drizzle(pool, { schema }) },
    PoolCloser,
  ],
  exports: [DB, PG_POOL],
})
export class DbModule {}
