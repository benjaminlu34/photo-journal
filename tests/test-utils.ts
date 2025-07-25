import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

export async function setupTestDB() {
  try {
    // Drop and recreate schema
    await db.execute(sql`
      DROP SCHEMA public CASCADE;
      CREATE SCHEMA public;
    `);
    
    // Execute the main migration file directly
    const migrationPath = path.resolve(__dirname, '../migrations/0000_soft_sphinx.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Remove comments and split by statement breakpoints
    const cleanSQL = migrationSQL
      .replace(/--.*$/gm, '') // Remove line comments
      .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove block comments
    
    const statements = cleanSQL.split('--> statement-breakpoint');
    
    for (const statement of statements) {
      const cleanStatement = statement.trim();
      if (cleanStatement) {
        try {
          await db.execute(sql.raw(cleanStatement));
        } catch (error: any) {
          // Ignore "already exists" errors during setup
          if (!error.message?.includes('already exists') && 
              !error.message?.includes('duplicate key value')) {
            console.error('Failed to execute statement:', cleanStatement.substring(0, 100) + '...');
            console.error('Error:', error.message);
            throw error;
          }
        }
      }
    }
    
    // Add username format constraint from migration 0006 (fixed regex)
    try {
      await db.execute(sql.raw(`
        ALTER TABLE users ADD CONSTRAINT username_format 
        CHECK (username IS NULL OR username ~ '^[a-z0-9_]{3,20}$')
      `));
    } catch (error: any) {
      // Ignore if constraint already exists
      if (!error.message?.includes('already exists')) {
        console.error('Failed to add username_format constraint:', error.message);
        throw error;
      }
    }
    
    // Add reserved username constraint from migration 0009
    try {
      await db.execute(sql`
        ALTER TABLE users ADD CONSTRAINT username_reserved 
        CHECK (username IS NULL OR username NOT IN ('admin','api','support','help','root','system','moderator'))
      `);
    } catch (error: any) {
      // Ignore if constraint already exists
      if (!error.message?.includes('already exists')) {
        console.error('Failed to add username_reserved constraint:', error.message);
        throw error;
      }
    }
    
    console.log('✅ Test database setup completed successfully');
  } catch (error) {
    console.error('❌ Schema creation failed:', error);
    throw error;
  }
}

export async function teardownTestDB() {
  // You can add cleanup logic here if needed
}