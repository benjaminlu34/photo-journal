#!/usr/bin/env tsx

/**
 * Migration script to add default backgroundColor to existing sticky notes
 * This script adds backgroundColor: '--note-bg-default' to all existing sticky_note content blocks
 * that don't already have a backgroundColor field.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { contentBlocks } from '../shared/schema/schema';
import { sql } from 'drizzle-orm';

// Get database URL from environment
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

console.log('🔄 Starting note color migration...');

async function migrateNoteColors() {
  // Create database connection
  const client = postgres(databaseUrl);
  const db = drizzle(client);

  try {
    // First, check how many sticky notes exist without backgroundColor
    const countResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM content_blocks 
      WHERE type = 'sticky_note' 
        AND content->>'type' = 'sticky_note'
        AND content->>'backgroundColor' IS NULL
    `);

    const notesToUpdate = parseInt(countResult[0].count as string);
    console.log(`📊 Found ${notesToUpdate} sticky notes without backgroundColor`);

    if (notesToUpdate === 0) {
      console.log('✅ No notes need migration. All sticky notes already have backgroundColor.');
      return;
    }

    // Perform the migration
    console.log('🔄 Updating notes with default backgroundColor...');

    const updateResult = await db.execute(sql`
      UPDATE content_blocks 
      SET content = jsonb_set(
        content, 
        '{backgroundColor}', 
        '"#F4F7FF"'::jsonb
      )
      WHERE 
        type = 'sticky_note' 
        AND content->>'type' = 'sticky_note'
        AND content->>'backgroundColor' IS NULL
    `);

    console.log(`✅ Successfully updated ${updateResult.rowCount || notesToUpdate} sticky notes`);

    // Verify the migration
    const verifyResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM content_blocks 
      WHERE type = 'sticky_note' 
        AND content->>'backgroundColor' = '#F4F7FF'
    `);

    const updatedCount = parseInt(verifyResult[0].count as string);
    console.log(`🔍 Verification: ${updatedCount} notes now have default backgroundColor`);

    // Show sample of updated notes (first 3)
    const sampleResult = await db.execute(sql`
      SELECT id, content->>'text' as text, content->>'backgroundColor' as background_color
      FROM content_blocks 
      WHERE type = 'sticky_note' 
        AND content->>'backgroundColor' = '#F4F7FF'
      LIMIT 3
    `);

    if (sampleResult.length > 0) {
      console.log('\n📝 Sample updated notes:');
      sampleResult.forEach((note, index) => {
        const noteText = note.text as string;
        const backgroundColor = note.background_color as string;
        console.log(`  ${index + 1}. ID: ${note.id}`);
        console.log(`     Text: "${noteText?.substring(0, 50)}${noteText?.length > 50 ? '...' : ''}"`);
        console.log(`     Background: ${backgroundColor}`);
      });
    }

    console.log('\n🎉 Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

if (isDryRun) {
  console.log('🔍 DRY RUN MODE - No changes will be made');

  async function dryRun() {
    const client = postgres(databaseUrl);
    const db = drizzle(client);

    try {
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM content_blocks 
        WHERE type = 'sticky_note' 
          AND content->>'type' = 'sticky_note'
          AND content->>'backgroundColor' IS NULL
      `);

      const notesToUpdate = parseInt(countResult[0].count as string);
      console.log(`📊 Would update ${notesToUpdate} sticky notes`);

      if (notesToUpdate > 0) {
        const sampleResult = await db.execute(sql`
          SELECT id, content->>'text' as text
          FROM content_blocks 
          WHERE type = 'sticky_note' 
            AND content->>'type' = 'sticky_note'
            AND content->>'backgroundColor' IS NULL
          LIMIT 5
        `);

        console.log('\n📝 Sample notes that would be updated:');
        sampleResult.forEach((note, index) => {
          const noteText = note.text as string;
          console.log(`  ${index + 1}. ID: ${note.id}`);
          console.log(`     Text: "${noteText?.substring(0, 50)}${noteText?.length > 50 ? '...' : ''}"`);
        });
      }
    } finally {
      await client.end();
    }
  }

  dryRun().catch(console.error);
} else {
  migrateNoteColors().catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
}