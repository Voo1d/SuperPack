import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import * as path from 'node:path';
import { Pool } from 'pg';

/** Применяет SQL-миграции из папки drizzle/. Работает и из src (ts-node), и из dist (собранный образ). */
export async function runMigrations(databaseUrl: string): Promise<void> {
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder: path.resolve(__dirname, '../../drizzle') });
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL не задан');
    process.exit(1);
  }
  runMigrations(url)
    .then(() => console.log('Миграции применены'))
    .catch((err) => {
      console.error('Ошибка миграции:', err);
      process.exit(1);
    });
}
