import { db } from '../server/db';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll } from 'vitest';

beforeAll(async () => {
  await db.execute(`
    DROP SCHEMA public CASCADE;
    CREATE SCHEMA public;
  `)
  await migrate(db, { migrationsFolder: './migrations' });
});

afterAll(async () => {
  // You can add cleanup logic here if needed
});
