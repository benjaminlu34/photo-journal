// server/db.ts
import 'dotenv/config';               // ← loads .env before anything else

import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '@shared/schema/schema';

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
/*  Environment-specific SSL configuration                            */
/* ------------------------------------------------------------------ */
const isSupabase = DATABASE_URL.includes('supabase.co');
const isLocalDocker = DATABASE_URL.includes('localhost:5432');

const sslConfig = isSupabase 
  ? { rejectUnauthorized: false }  // Supabase requires SSL but accepts self-signed
  : false;                        // Local Docker doesn't need SSL

/* ------------------------------------------------------------------ */
/*  Connection configuration                                          */
/* ------------------------------------------------------------------ */
const poolConfig = {
  connectionString: DATABASE_URL,
  ssl: sslConfig,
  max: 20,                        // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,      // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return error after 2 seconds if connection could not be established
};

/* ------------------------------------------------------------------ */
/*  Create pool and drizzle instance                                  */
/* ------------------------------------------------------------------ */
export const pool = new Pool(poolConfig);
export const db = drizzle({ client: pool, schema });

/* ------------------------------------------------------------------ */
/*  Connection validation                                             */
/* ------------------------------------------------------------------ */
pool.on('connect', () => {
  console.log('✅ Database connected successfully');
});

pool.on('error', (err: Error) => {
  console.error('❌ Database connection error:', err.message);
});

// Test connection on startup
pool.query('SELECT NOW()')
  .then((result: { rows: { now: string }[] }) => {
    console.log('🗄️ Database ready:', result.rows[0].now);
  })
  .catch((err: Error) => {
    console.error('❌ Database connection failed:', err.message);
    console.error('DATABASE_URL:', DATABASE_URL?.replace(/:[^:@]*@/, ':***@')); // Hide password
  });
