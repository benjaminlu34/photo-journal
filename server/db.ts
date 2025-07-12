// server/db.ts
import 'dotenv/config';               // ← loads .env before anything else

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from '@shared/schema';

// Neon’s WS driver for local + serverless
neonConfig.webSocketConstructor = ws;

/* ------------------------------------------------------------------ */
/*  Validate env                                                      */
/* ------------------------------------------------------------------ */
const { DATABASE_URL } = process.env;

if (!DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. Create a .env file or export the variable before starting the server.',
  );
}

/* ------------------------------------------------------------------ */
/*  Drizzle + PG pool                                                 */
/* ------------------------------------------------------------------ */
export const pool = new Pool({ connectionString: DATABASE_URL });
export const db   = drizzle({ client: pool, schema });
